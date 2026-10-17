import { AppFeature } from '~/settings';
import { logSoftFailure } from '~/utilities/attempt';

export type QueueTask<T> = () => Promise<T>;

export class AsyncQueue<T = void> {
  private readonly maxSize: number;
  private readonly onError: ((err: unknown) => void) | undefined;
  private readonly queue: QueueTask<T>[] = [];
  private processing = false;

  constructor(maxSize = 500, onError?: (err: unknown) => void) {
    this.maxSize = maxSize;
    this.onError = onError;
  }

  enqueue(task: QueueTask<T>): boolean {
    if (this.queue.length >= this.maxSize) {
      return false;
    }
    this.queue.push(task);
    if (!this.processing) {
      void this.drain();
    }
    return true;
  }

  get size(): number {
    return this.queue.length;
  }

  private async drain(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        await task();
      } catch (err) {
        logSoftFailure(AppFeature.System, 'ASYNC_QUEUE_TASK_FAILED', { pending: this.queue.length, maxSize: this.maxSize }, err);
        this.onError?.(err);
      }
    }
    this.processing = false;
  }
}
