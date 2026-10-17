import { Cron } from 'croner';

import { AppFeature } from '~/settings';
import { Client } from './Client';
import { attempt, Logger } from '~/utilities';

export type SchedulableOptions = {
  name: string;
  feature: AppFeature;
  description: string;
  /** Lazy so config is read at registration time (after loadConfig()), not at module import. */
  defaultCron: () => string;
  execute: (client: Client, logger: Logger) => Promise<string | void>;
};

export class Schedulable {
  public readonly options: SchedulableOptions;
  public readonly logger: Logger;

  private job: Cron | null = null;
  private activeCron: string | null = null;

  constructor(options: SchedulableOptions) {
    this.options = options;
    this.logger = Logger.getInstance(options.feature);
  }

  get name(): string {
    return this.options.name;
  }

  get currentCron(): string {
    return this.activeCron ?? this.options.defaultCron();
  }

  public start(client: Client, cron?: string): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
    this.activeCron = cron ?? this.options.defaultCron();

    this.logger.info({ cron: this.activeCron }, `Schedulable [${this.options.name}] starting.`);

    this.job = new Cron(this.activeCron, { name: this.options.name, protect: true }, async () => {
      const startedAt = Date.now();
      this.logger.info(`Schedulable [${this.options.name}] tick started.`);

      // Must be awaited: Croner's `protect` only suppresses overlap while the callback promise is pending.
      const summary = await attempt(async () => await this.options.execute(client, this.logger), {
        errorCode: 'SCHEDULABLE_TICK',
        context: { schedulable: this.options.name, cron: this.activeCron },
        // Console only — a failing tick must not post an error embed into the guild.
        onError: (err) => this.logger.error(Object(err), `Schedulable [${this.options.name}] tick failed.`),
      });

      this.logger.info({ durationMs: Date.now() - startedAt, summary: summary ?? null }, `Schedulable [${this.options.name}] tick finished.`);
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
}
