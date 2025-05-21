import { Client, TextChannel } from 'discord.js';
import DatabaseClient from '~/database';
import { appFeatureMap, Colors, LogNamespace, ProcessExitCode } from '~/settings';
import { Logger } from '~/utilities';
import { ErrorEmbed } from '../components/Error';
import { baseLocale } from '../locales';

enum ErrorLogNamespace {
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export interface GenericException {
  readonly recoverable: boolean;
  toString: () => string;
}

/** Defines a recoverable exception */
export class RecoverableException extends Error implements GenericException {
  public readonly recoverable: boolean = true;
  private client: Client;
  private dateTime: Date;

  constructor(client: Client, msg: string, options?: unknown) {
    super(msg, options as Object);
    this.dateTime = new Date();
    this.client = client;

    this.logDiscord().then(() => this.log());
  }

  private log(): void {
    Logger.getInstance().error(this.cause as Object, this.toString());
  }

  private async logDiscord() {
    const guildList = this.client.guilds.cache.values().toArray();
    const errorEmbed = new ErrorEmbed({ color: Colors.Red, locale: baseLocale, error: this });

    for (const { id } of guildList) {
      const config = await DatabaseClient.loadConfig(id);
      if (!config.system.systemNotificationEnabled || !config.system.notificationChannelId) return;
      await (this.client.channels.cache.get(config.system.notificationChannelId) as TextChannel).send({
        embeds: [errorEmbed.render()],
        files: errorEmbed.attachments,
      });
    }
  }

  public toString(): string {
    return `[${ErrorLogNamespace.ERROR}] at ${this.dateTime.toISOString()}; ${this.name}: ${this.message}`;
  }
}

/** Defines a fatal error */
export class FatalException extends Error implements GenericException {
  public readonly recoverable: boolean = false;
  private client: Client;
  private dateTime: Date;

  constructor(client: Client, msg: string, options?: unknown) {
    super(msg, options as Object);
    this.dateTime = new Date();
    this.client = client;

    this.log();
    this.logDiscord().then(() => this.exit());
  }

  private log(): void {
    Logger.getInstance().fatal(this.toString());
  }

  private async logDiscord() {
    const guildList = this.client.guilds.cache.values().toArray();
    for (const { id } of guildList) {
      const config = await DatabaseClient.loadConfig(id);
      if (!config.system.systemNotificationEnabled || !config.system.notificationChannelId) return;
      await (this.client.channels.cache.get(config.system.notificationChannelId) as TextChannel).send('fuck. i died');
    }
  }

  public exit(): void {
    process.exit(ProcessExitCode.ERROR);
  }

  public toString(): string {
    return `[${ErrorLogNamespace.ERROR}] at ${this.dateTime.toISOString()}; ${this.name}: ${this.message}`;
  }
}
