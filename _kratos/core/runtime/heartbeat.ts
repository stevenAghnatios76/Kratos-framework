import { Worker } from './worker';

export class HeartbeatMonitor {
  private workers: Map<string, Worker>;
  private intervalSec: number;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(workers: Map<string, Worker>, intervalSec: number) {
    this.workers = workers;
    this.intervalSec = intervalSec;
  }

  start(): void {
    this.intervalId = setInterval(() => {
      this.check();
    }, this.intervalSec * 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  check(): {
    healthy: string[];
    stalled: string[];
    completed: string[];
    failed: string[];
  } {
    const healthy: string[] = [];
    const stalled: string[] = [];
    const completed: string[] = [];
    const failed: string[] = [];

    for (const [id, worker] of this.workers) {
      switch (worker.state) {
        case 'completed':
          completed.push(id);
          break;
        case 'failed':
          failed.push(id);
          break;
        case 'running':
          if (worker.isStalled(this.intervalSec * 2)) {
            stalled.push(id);
          } else {
            healthy.push(id);
          }
          break;
        case 'stalled':
          stalled.push(id);
          break;
        default:
          break;
      }
    }

    return { healthy, stalled, completed, failed };
  }

  async handleStalled(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    console.warn(`[heartbeat] Worker ${workerId} appears stalled, waiting one more interval...`);
    worker.state = 'stalled';

    // Wait one more interval before aborting
    await new Promise(resolve => setTimeout(resolve, this.intervalSec * 1000));

    if (worker.isStalled(this.intervalSec)) {
      console.error(`[heartbeat] Worker ${workerId} confirmed stalled, aborting.`);
      await worker.abort();
    }
  }
}
