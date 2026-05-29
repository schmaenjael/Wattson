import { type Bindings, type ChildLoggerOptions, type Logger as PinoLogger, pino } from 'pino';
import { EmbedBuilder, type TextChannel } from 'discord.js';

import { AppFeature, appFeatureMap, LogNamespace } from '~/settings';
import type { Client } from '~/core/models/Client';

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

export type LogTarget = 'moderation' | 'surveillance';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: object;
  /** Which internal Discord channel to route to. Omit for console-only. */
  target?: LogTarget;
  /** Verbose embed posted to the internal mod/surveillance channel. */
  internalEmbed?: EmbedBuilder;
  /** Redacted embed posted to the public transparency log. Omit to suppress. Never posted for debug/fatal. */
  publicEmbed?: EmbedBuilder;
}

export class Logger {
  private logger: PinoLogger<string, boolean>;
  private static parentLogger: Logger;
  private static loggerPool = new Map<LogNamespace, Logger>();
  private static discordClient: Client | null = null;

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

  /** Call once in ready.ts after the client is connected to enable Discord routing. */
  public static initDiscord(client: Client): void {
    Logger.discordClient = client;
  }

  /**
   * Unified log: always writes to pino; optionally routes to Discord channels.
   * Provide `internalEmbed` and/or `publicEmbed` to enable Discord routing.
   * `debug` level never reaches Discord in production. `fatal` never reaches the public log.
   */
  public async log(entry: LogEntry): Promise<void> {
    const { level, message, data = {}, target, internalEmbed, publicEmbed } = entry;

    // Pino — always, synchronous
    this.logger[level](data, message);

    // Discord — only when a client is available and at least one embed is provided
    if (!Logger.discordClient) return;
    if (!internalEmbed && !publicEmbed) return;

    const isDev = process.env.NODE_ENV !== 'production';
    if (level === 'debug' && !isDev) return;

    const { getSettings } = await import('~/database');
    const settings = await getSettings();

    const guild = await Logger.discordClient.guilds.fetch(process.env.GUILD_ID).catch(() => null);
    if (!guild) return;

    const send = async (channelId: string | null | undefined, embed: EmbedBuilder): Promise<void> => {
      if (!channelId) return;
      const ch = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
      await ch?.send({ embeds: [embed] }).catch(() => null);
    };

    // Internal channel (moderation or surveillance)
    if (internalEmbed) {
      const channelId = target === 'moderation' ? settings.modLogChannelId : settings.surveillanceLogChannelId;
      await send(channelId, internalEmbed);
    }

    // Public channel — never for debug or fatal
    if (publicEmbed && level !== 'debug' && level !== 'fatal') {
      await send(settings.publicLogChannelId, publicEmbed);
    }
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
