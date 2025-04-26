import { AppFeature } from '~/settings';
import { Logger } from '~/utilities/Logger';

export class Utils {
  private static readonly logger = Logger.getInstance(AppFeature.System);

  /** Checks if a string contains a discord invite link */
  public static containsDiscordInvite(text: string) {
    return /(https?:\/\/)?(www.)?(discord.(gg|io|me|li|link|plus)|discorda?p?p?.com\/invite|invite.gg|dsc.gg|urlcord.cf)\/[^\s/]+?(?=\b)/.test(text);
  }

  /** Measures async and sync function performance and loggs it with pino */
  public static measurePerformance = <T extends (...args: any[]) => any>(target: T, name: string): ((...args: Parameters<T>) => ReturnType<T>) => {
    return (...args: Parameters<T>): ReturnType<T> => {
      const startTime = performance.now();
      const result = target(...args);
      const log = () => this.logger.info(`Measured performance of ${name}: Executed in ${Math.ceil(performance.now() - startTime)}ms.`);

      return result instanceof Promise ? (result.finally(log) as ReturnType<T>) : (log(), result);
    };
  };

  /** Yields a random Integer */
  public static randomInteger = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
}
