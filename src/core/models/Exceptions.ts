import { Client, TextChannel } from 'discord.js';

import { getSettings } from '~/database';
import { Colors } from '~/settings';
import { Logger } from '~/utilities';
import { ErrorEmbed } from '../components/Error';
import { baseLocale } from '../locales';

export class BotException extends Error {
  private readonly client: Client;
  private readonly dateTime: Date;

  constructor(client: Client, msg: string, cause?: unknown) {
    super(msg, { cause });
    this.name = 'BotException';
    this.dateTime = new Date();
    this.client = client;

    this.logDiscord().then(() => this.log());
  }

  private log(): void {
    Logger.getInstance().error(Object(this.cause), this.toString());
  }

  private async logDiscord(): Promise<void> {
    try {
      const settings = await getSettings();
      if (!settings.featureSystemNotificationsEnabled || !settings.notificationChannelId) return;

      const errorEmbed = new ErrorEmbed({ color: Colors.Red, locale: baseLocale, error: this });
      const channel = this.client.channels.cache.get(settings.notificationChannelId) as TextChannel | undefined;
      await channel?.send({ embeds: [errorEmbed.render()], files: errorEmbed.attachments });
    } catch (e) {
      Logger.getInstance().error(Object(e), 'Failed to report BotException to Discord.');
    }
  }

  public toString(): string {
    return `[ERROR] at ${this.dateTime.toISOString()}; ${this.name}: ${this.message}`;
  }
}
