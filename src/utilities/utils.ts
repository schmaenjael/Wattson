import { AppFeature } from '~/settings';
import { Logger } from '~/utilities/Logger';

const logger = Logger.getInstance(AppFeature.System);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const measurePerformance = <T extends (...args: any[]) => any>(target: T, name: string): ((...args: Parameters<T>) => ReturnType<T>) => {
  return (...args: Parameters<T>): ReturnType<T> => {
    const startTime = performance.now();
    const result = target(...args);
    const log = () => logger.info(`Measured performance of ${name}: Executed in ${Math.ceil(performance.now() - startTime)}ms.`);

    return result instanceof Promise ? (result.finally(log) as ReturnType<T>) : (log(), result);
  };
};

export const toTitleCase = (str: string) => str.replace(/\w\S*/g, (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase());

export type DiscordTimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R';

export const discordTimestamp = (date: Date, style: DiscordTimestampStyle): string => `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;

export const chunkText = (text: string, maxLen: number): string[] => {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    if (start + maxLen >= text.length) {
      chunks.push(text.slice(start));
      break;
    }
    const end = start + maxLen;
    const lastNewline = text.lastIndexOf('\n', end);
    const lastSpace = text.lastIndexOf(' ', end);
    const breakAt = lastNewline > start ? lastNewline : lastSpace > start ? lastSpace : end;
    chunks.push(text.slice(start, breakAt));
    start = breakAt + (text[breakAt] === '\n' || text[breakAt] === ' ' ? 1 : 0);
  }
  return chunks;
};
