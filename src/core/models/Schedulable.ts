import { Cron } from 'croner';
import { EmbedBuilder, TextChannel } from 'discord.js';

import { AppFeature, appFeatureMap } from '~/settings';
import { getSettings } from '~/database';
import { Client } from './Client';
import { Logger } from '~/utilities';

export type SchedulableOptions = {
  name: string;
  feature: AppFeature;
  description: string;
  defaultCron: string;
  execute: (client: Client, logger: Logger) => Promise<string | void>;
};

export class Schedulable {
  public readonly options: SchedulableOptions;
  public readonly logger: Logger;

  private job: Cron | null = null;
  private activeCron: string;

  constructor(options: SchedulableOptions) {
    this.options = options;
    this.logger = Logger.getInstance(options.feature);
    this.activeCron = options.defaultCron;
  }

  get name(): string {
    return this.options.name;
  }

  get currentCron(): string {
    return this.activeCron;
  }

  public start(client: Client, cron?: string): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
    this.activeCron = cron ?? this.options.defaultCron;

    this.logger.info({ cron: this.activeCron }, `Schedulable [${this.options.name}] starting.`);

    this.job = new Cron(this.activeCron, { name: this.options.name, protect: true }, async () => {
      const startedAt = Date.now();
      this.logger.info(`Schedulable [${this.options.name}] tick started.`);

      let summary: string | void;
      try {
        summary = await this.options.execute(client, this.logger);
      } catch (err) {
        this.logger.error(Object(err), `Schedulable [${this.options.name}] tick failed.`);
        await this.postNotification(client, null, Date.now() - startedAt, err as Error);
        return;
      }

      await this.postNotification(client, summary ?? null, Date.now() - startedAt, null);
    });
  }

  public restart(client: Client, cron?: string): void {
    this.start(client, cron);
    this.logger.info({ cron: this.activeCron }, `Schedulable [${this.options.name}] rescheduled.`);
  }

  public stop(): void {
    this.job?.stop();
    this.job = null;
  }

  private async postNotification(client: Client, summary: string | null, durationMs: number, error: Error | null): Promise<void> {
    try {
      const settings = await getSettings();
      if (!settings.notificationChannelId) return;

      const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
      if (!guild) return;

      const channel = (await guild.channels.fetch(settings.notificationChannelId).catch(() => null)) as TextChannel | null;
      if (!channel?.isSendable()) return;

      const color = appFeatureMap[this.options.feature].color;
      const embed = new EmbedBuilder()
        .setColor(error ? '#EF4444' : color)
        .setTitle(`${error ? '❌' : '✅'} Schedulable: ${this.options.name}`)
        .addFields(
          { name: 'Cron', value: `\`${this.activeCron}\``, inline: true },
          { name: 'Duration', value: `${durationMs}ms`, inline: true },
          { name: 'Next run', value: this.job?.nextRun() ? `<t:${Math.floor(this.job.nextRun()!.getTime() / 1000)}:R>` : '—', inline: true }
        )
        .setTimestamp();

      if (error) {
        embed.addFields({ name: 'Error', value: `\`\`\`${String(error).slice(0, 900)}\`\`\`` });
      } else if (summary) {
        embed.addFields({ name: 'Summary', value: summary.slice(0, 1024) });
      }

      await channel.send({ embeds: [embed] }).catch(() => null);
    } catch {
      // notification failure must not propagate
    }
  }
}
