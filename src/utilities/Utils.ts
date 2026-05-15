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
