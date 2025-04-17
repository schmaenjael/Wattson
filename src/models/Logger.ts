import { type Bindings, type ChildLoggerOptions, type Logger as PinoLogger, pino } from 'pino';

import { AppFeature, appFeatureMap, LogNamespace } from '~/constants';
import { config } from 'bot.config';

export class Logger {
  private logger: PinoLogger<string, boolean>;
  private static parentLogger: Logger;
  private static loggerPool: Map<string, any> = new Map<LogNamespace, Logger>();

  private constructor() {
    this.logger = pino({
      level: process.env.NODE_ENV === 'production' ? 'warn' : process.env.NODE_ENV === 'test' ? 'info' : 'trace',
      redact: { paths: process.env.NODE_ENV !== 'development' ? ['*.token', 'token'] : [], censor: '[REDACTED]' },
      timestamp: () => `,"timestamp":"${new Date(Date.now()).toISOString()}"`,
      formatters: { level: (label: string) => ({ level: label.toUpperCase() }) },
      transport: config.appLog[process.env.NODE_ENV],
    });
  }

  public static getInstance(module: AppFeature = AppFeature.System): Logger {
    const ns = appFeatureMap[module].namespace;

    if (!this.parentLogger) this.parentLogger = new Logger();
    if (!this.loggerPool.get(ns)) this.loggerPool.set(ns, this.parentLogger.getChildLogger({}, { msgPrefix: ns }));

    return this.loggerPool.get(ns);
  }

  public fatal(obj: Object, msg?: string) {
    this.logger.fatal(obj, msg);
  }

  public error(obj: Object, msg?: string) {
    this.logger.error(obj, msg);
  }

  public warn(obj: Object, msg?: string) {
    this.logger.warn(obj, msg);
  }

  public info(obj: Object, msg?: string) {
    this.logger.info(obj, msg);
  }

  public debug(obj: Object, msg?: string) {
    this.logger.debug(obj, msg);
  }

  protected getChildLogger(bindings: Bindings, options?: ChildLoggerOptions) {
    return this.logger.child(bindings, options);
  }
}
