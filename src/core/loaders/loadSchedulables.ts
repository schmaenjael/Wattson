import { Collection } from 'discord.js';

import { Schedulable } from '~/core/models';
import { Client } from '~/core/models';
import { Logger } from '~/utilities';
import { AppFeature } from '~/settings';
import { getSchedulableConfig } from '~/database';

import { banSchedulable } from '~/core/scheduler/banSchedulable';
import { muteSchedulable } from '~/core/scheduler/muteSchedulable';
import { modmailSchedulable } from '~/core/scheduler/modmailSchedulable';
import { eventSchedulable } from '~/core/scheduler/eventSchedulable';
import { verificationSchedulable } from '~/core/scheduler/verificationSchedulable';
import { suggestionSchedulable } from '~/core/scheduler/suggestionSchedulable';
import { warningSchedulable } from '~/core/scheduler/warningSchedulable';
import { analyticsSchedulable } from '~/core/scheduler/analyticsSchedulable';
import { statChannelsSchedulable } from '~/core/scheduler/statChannelsSchedulable';

const ALL_SCHEDULABLES: Schedulable[] = [
  banSchedulable,
  muteSchedulable,
  modmailSchedulable,
  eventSchedulable,
  verificationSchedulable,
  suggestionSchedulable,
  warningSchedulable,
  analyticsSchedulable,
  statChannelsSchedulable,
];

const registry = new Collection<string, Schedulable>();

export const SCHEDULABLE_CHOICES: { name: string; value: string }[] = ALL_SCHEDULABLES.map((s) => ({
  name: `${s.name} — ${s.options.description}`.slice(0, 100),
  value: s.name,
}));

export const getSchedulables = (): Collection<string, Schedulable> => registry;

export const loadSchedulables = async (client: Client): Promise<void> => {
  const logger = Logger.getInstance(AppFeature.Scheduler);

  for (const schedulable of ALL_SCHEDULABLES) {
    registry.set(schedulable.name, schedulable);

    const config = await getSchedulableConfig(schedulable.name).catch(() => undefined);
    const cron = config?.cronExpression ?? schedulable.options.defaultCron();

    schedulable.start(client, cron);
    logger.info({ name: schedulable.name, cron }, `Schedulable [${schedulable.name}] registered (cron: ${cron}).`);
  }

  logger.info(`Loaded ${registry.size} schedulable(s): ${ALL_SCHEDULABLES.map((s) => s.name).join(', ')}`);
};
