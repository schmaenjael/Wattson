import { Logger } from '~/models';

export const measurePerformance = <T extends (...args: any[]) => any>(
  target: T,
  name: string
): ((...args: Parameters<T>) => ReturnType<T>) => {
  return (...args: Parameters<T>): ReturnType<T> => {
    const time: { startTime: DOMHighResTimeStamp; endTime?: DOMHighResTimeStamp } = { startTime: performance.now() };
    let result = target(...args);

    if (result instanceof Promise) result = result.then((res) => res) as ReturnType<T>;

    time.endTime = performance.now();

    Logger.getInstance().info(`Measured performance of ${name}: Executed in ${time.startTime - time.endTime}ms.`);

    return result;
  };
};
