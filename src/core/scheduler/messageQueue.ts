import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

type Task = () => Promise<void>;

const MAX_QUEUE_SIZE = 500;
const queue: Task[] = [];
let processing = false;

const drain = async (): Promise<void> => {
  processing = true;
  while (queue.length > 0) {
    const task = queue.shift()!;
    try {
      await task();
    } catch (err) {
      Logger.getInstance(AppFeature.Surveillance).error(Object(err), 'Message queue task threw unexpectedly.');
    }
  }
  processing = false;
};

export const enqueueMessage = (task: Task): boolean => {
  if (queue.length >= MAX_QUEUE_SIZE) return false;
  queue.push(task);
  if (!processing) void drain();
  return true;
};

export const getQueueSize = (): number => queue.length;
