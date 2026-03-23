import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'yaml';

export interface Checkpoint {
  workflow: string;
  step: number;
  total_steps: number;
  variables: Record<string, string>;
  output_path?: string;
  files_touched: {
    path: string;
    checksum: string;
    last_modified: string;
  }[];
  created_at: string;
  status: 'active' | 'completed';
}

export class CheckpointManager {
  private checkpointDir: string;

  constructor(checkpointDir: string) {
    this.checkpointDir = checkpointDir;
  }

  async write(checkpoint: Checkpoint): Promise<string> {
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }

    // Compute checksums for files_touched
    for (const file of checkpoint.files_touched) {
      if (fs.existsSync(file.path)) {
        const content = fs.readFileSync(file.path);
        file.checksum = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
        const stat = fs.statSync(file.path);
        file.last_modified = stat.mtime.toISOString();
      }
    }

    checkpoint.created_at = new Date().toISOString();

    const timestamp = Date.now();
    const fileName = `${checkpoint.workflow}-step-${checkpoint.step}-${timestamp}.yaml`;
    const filePath = path.join(this.checkpointDir, fileName);

    fs.writeFileSync(filePath, yaml.stringify(checkpoint), 'utf-8');
    return filePath;
  }

  async getLatest(workflow: string): Promise<Checkpoint | null> {
    if (!fs.existsSync(this.checkpointDir)) return null;

    const files = fs.readdirSync(this.checkpointDir)
      .filter(f => f.startsWith(workflow) && f.endsWith('.yaml'))
      .sort()
      .reverse();

    if (files.length === 0) return null;

    const content = fs.readFileSync(path.join(this.checkpointDir, files[0]), 'utf-8');
    return yaml.parse(content) as Checkpoint;
  }

  async validate(checkpoint: Checkpoint): Promise<{
    valid: boolean;
    changed_files: string[];
    missing_files: string[];
  }> {
    const changed_files: string[] = [];
    const missing_files: string[] = [];

    for (const file of checkpoint.files_touched) {
      if (!fs.existsSync(file.path)) {
        missing_files.push(file.path);
        continue;
      }

      const content = fs.readFileSync(file.path);
      const currentChecksum = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;

      if (currentChecksum !== file.checksum) {
        changed_files.push(file.path);
      }
    }

    return {
      valid: changed_files.length === 0 && missing_files.length === 0,
      changed_files,
      missing_files,
    };
  }

  async archive(checkpointPath: string): Promise<void> {
    const completedDir = path.join(this.checkpointDir, 'completed');
    if (!fs.existsSync(completedDir)) {
      fs.mkdirSync(completedDir, { recursive: true });
    }

    const fileName = path.basename(checkpointPath);
    const destPath = path.join(completedDir, fileName);
    fs.renameSync(checkpointPath, destPath);
  }

  async listActive(): Promise<Checkpoint[]> {
    if (!fs.existsSync(this.checkpointDir)) return [];

    const files = fs.readdirSync(this.checkpointDir)
      .filter(f => f.endsWith('.yaml') && !f.startsWith('upgrade-'));

    const checkpoints: Checkpoint[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.checkpointDir, file), 'utf-8');
        const cp = yaml.parse(content) as Checkpoint;
        if (cp.status === 'active') {
          checkpoints.push(cp);
        }
      } catch {
        // Skip invalid checkpoint files
      }
    }

    return checkpoints;
  }

  async cleanup(maxAgeDays: number): Promise<number> {
    const completedDir = path.join(this.checkpointDir, 'completed');
    if (!fs.existsSync(completedDir)) return 0;

    const cutoff = Date.now() - maxAgeDays * 86400000;
    const files = fs.readdirSync(completedDir);
    let removed = 0;

    for (const file of files) {
      const filePath = path.join(completedDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        removed++;
      }
    }

    return removed;
  }
}
