import { type Bindings, type ChildLoggerOptions, type Logger as PinoLogger, pino } from 'pino';

import { AppFeature, appFeatureMap, LogNamespace } from '~/settings';

const REDACT_PATHS = [
  'token',
  '*.token',
  'password',
  '*.password',
  'authorization',
  '*.authorization',
  'apiKey',
  '*.apiKey',
  'api_key',
  '*.api_key',
  'email',
  '*.email',
  'BOT_PASSWORD',
  '*.BOT_PASSWORD',
  'POSTGRES_PASSWORD',
  '*.POSTGRES_PASSWORD',
];

export class Logger {
  private logger: PinoLogger<string, boolean>;
  private static parentLogger: Logger;
  private static loggerPool = new Map<LogNamespace, Logger>();

  private constructor() {
    this.logger = pino({
      level: process.env.NODE_ENV === 'production' ? 'info' : process.env.NODE_ENV === 'test' ? 'info' : 'trace',
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      timestamp: () => `,"timestamp":"${new Date(Date.now()).toISOString()}"`,
      formatters: { level: (label: string) => ({ level: label.toUpperCase() }) },
    });
  }

  public static getInstance(module: AppFeature = AppFeature.System): Logger {
    const ns = appFeatureMap[module].namespace;

    if (!this.parentLogger) this.parentLogger = new Logger();
    if (!this.loggerPool.has(ns)) {
      const wrapper = Object.create(Logger.prototype) as Logger;
      (wrapper as unknown as { logger: PinoLogger<string, boolean> }).logger = this.parentLogger.getChildLogger({}, { msgPrefix: `${ns} ` });
      this.loggerPool.set(ns, wrapper);
    }

    return this.loggerPool.get(ns)!;
  }

  public fatal(obj: object | string, msg?: string) {
    this.logger.fatal(obj as object, msg);
  }

  public error(obj: object | string, msg?: string) {
    this.logger.error(obj as object, msg);
  }

  public warn(obj: object | string, msg?: string) {
    this.logger.warn(obj as object, msg);
  }

  public info(obj: object | string, msg?: string) {
    this.logger.info(obj as object, msg);
  }

  public debug(obj: object | string, msg?: string) {
    this.logger.debug(obj as object, msg);
  }

  protected getChildLogger(bindings: Bindings, options?: ChildLoggerOptions) {
    return this.logger.child(bindings, options);
  }
}
