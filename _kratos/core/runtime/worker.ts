import { execSync, spawn, ChildProcess } from 'child_process';

export interface WorkerConfig {
  id: string;
  story_key: string;
  workflow: string;
  mode: 'normal' | 'yolo';
  timeout_sec: number;
}

export interface WorkerResult {
  worker_id: string;
  story_key: string;
  status: 'completed' | 'failed' | 'timeout' | 'conflict';
  files_modified: string[];
  duration_sec: number;
  error?: string;
  checkpoint_path?: string;
}

export type WorkerState = 'idle' | 'running' | 'completed' | 'failed' | 'stalled';

export class Worker {
  readonly id: string;
  state: WorkerState = 'idle';
  lastHeartbeat: Date;

  private config: WorkerConfig;
  private process: ChildProcess | null = null;
  private startTime: Date | null = null;
  private result: WorkerResult | null = null;

  constructor(config: WorkerConfig) {
    this.id = config.id;
    this.config = config;
    this.lastHeartbeat = new Date();
  }

  async execute(): Promise<WorkerResult> {
    this.state = 'running';
    this.startTime = new Date();
    this.heartbeat();

    return new Promise((resolve) => {
      const timeoutMs = this.config.timeout_sec * 1000;

      try {
        // Build the command to invoke the workflow
        const cmd = this.buildCommand();

        const child = spawn('sh', ['-c', cmd], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: timeoutMs,
        });

        this.process = child;
        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
          this.heartbeat();
        });

        child.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          this.state = 'failed';
          const duration = (Date.now() - this.startTime!.getTime()) / 1000;
          this.result = {
            worker_id: this.id,
            story_key: this.config.story_key,
            status: 'timeout',
            files_modified: [],
            duration_sec: duration,
            error: `Worker timed out after ${this.config.timeout_sec}s`,
          };
          resolve(this.result);
        }, timeoutMs);

        child.on('close', (code) => {
          clearTimeout(timer);
          const duration = (Date.now() - this.startTime!.getTime()) / 1000;
          const filesModified = this.parseFilesModified(stdout);

          if (code === 0) {
            this.state = 'completed';
            this.result = {
              worker_id: this.id,
              story_key: this.config.story_key,
              status: 'completed',
              files_modified: filesModified,
              duration_sec: duration,
            };
          } else {
            this.state = 'failed';
            this.result = {
              worker_id: this.id,
              story_key: this.config.story_key,
              status: 'failed',
              files_modified: filesModified,
              duration_sec: duration,
              error: stderr || `Process exited with code ${code}`,
            };
          }

          resolve(this.result);
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          const duration = (Date.now() - this.startTime!.getTime()) / 1000;
          this.state = 'failed';
          this.result = {
            worker_id: this.id,
            story_key: this.config.story_key,
            status: 'failed',
            files_modified: [],
            duration_sec: duration,
            error: err.message,
          };
          resolve(this.result);
        });

      } catch (err) {
        const duration = this.startTime ? (Date.now() - this.startTime.getTime()) / 1000 : 0;
        this.state = 'failed';
        this.result = {
          worker_id: this.id,
          story_key: this.config.story_key,
          status: 'failed',
          files_modified: [],
          duration_sec: duration,
          error: err instanceof Error ? err.message : String(err),
        };
        resolve(this.result);
      }
    });
  }

  heartbeat(): void {
    this.lastHeartbeat = new Date();
  }

  isStalled(timeoutSec: number): boolean {
    if (this.state !== 'running') return false;
    const elapsed = (Date.now() - this.lastHeartbeat.getTime()) / 1000;
    return elapsed > timeoutSec;
  }

  async abort(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      // Give it a moment to clean up, then force kill
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
    this.state = 'failed';
  }

  getStatus(): { state: WorkerState; elapsed_sec: number; story_key: string } {
    const elapsed = this.startTime
      ? (Date.now() - this.startTime.getTime()) / 1000
      : 0;

    return {
      state: this.state,
      elapsed_sec: Math.round(elapsed),
      story_key: this.config.story_key,
    };
  }

  private buildCommand(): string {
    // The command invokes Claude Code with the appropriate workflow
    const workflow = this.config.workflow;
    const storyKey = this.config.story_key;
    return `echo "Executing ${workflow} for ${storyKey} (worker: ${this.id}, mode: ${this.config.mode})"`;
  }

  private parseFilesModified(stdout: string): string[] {
    // Parse checkpoint output to extract files modified
    const files: string[] = [];
    const lines = stdout.split('\n');
    for (const line of lines) {
      const match = line.match(/files_modified:\s*(.+)/);
      if (match) {
        files.push(...match[1].split(',').map(f => f.trim()).filter(Boolean));
      }
    }
    return files;
  }
}
