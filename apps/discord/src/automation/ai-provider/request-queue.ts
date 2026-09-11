import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('LilyRequestQueue');

export interface QueueTask<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
  enqueuedAt: number;
}

/**
 * LilyRequestQueue — Centralized concurrency control queue.
 * Limits simultaneous requests to Groq (default: 2) to eliminate stampedes.
 */
export class LilyRequestQueue {
  private queue: QueueTask<any>[] = [];
  private activeCount = 0;
  private maxConcurrency: number;
  private maxQueueSize: number;

  constructor(maxConcurrency = 2, maxQueueSize = 50) {
    this.maxConcurrency = maxConcurrency;
    this.maxQueueSize = maxQueueSize;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public enqueue<T>(fn: () => Promise<T>): Promise<T> {
    if (this.queue.length >= this.maxQueueSize) {
      logger.warn(`[LilyRequestQueue] Queue overflow (${this.queue.length}/${this.maxQueueSize}). Rejecting request.`);
      return Promise.reject(new Error('Queue is temporarily full. Please try again in a few moments.'));
    }

    return new Promise<T>((resolve, reject) => {
      const task: QueueTask<T> = {
        id: Math.random().toString(36).substring(2, 9),
        fn,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      };

      this.queue.push(task);
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;

    task.fn()
      .then((res) => {
        task.resolve(res);
      })
      .catch((err) => {
        task.reject(err);
      })
      .finally(() => {
        this.activeCount--;
        this.processNext();
      });
  }
}
