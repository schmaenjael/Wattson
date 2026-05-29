export type QueueTask<T> = () => Promise<T>;

export class AsyncQueue<T = void> {
  private readonly maxSize: number;
  private readonly queue: QueueTask<T>[] = [];
  private processing = false;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
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
      } catch {
        // individual task failures must not stop the queue
      }
    }
    this.processing = false;
  }
}
