import { readdir } from 'node:fs/promises';
import { performance } from 'perf_hooks';

import { Client } from '~/models/Client';
import { Event } from '~/models';

import { Logger } from '~/models/Logger';

export const loadEvents = async (client: Client) => {
  const startTime = performance.now();

  const path = process.cwd() + '/src/events/';
  const files = await readdir(path, { recursive: true });
  const logger = Logger.getInstance();

  for (const file of files) {
    if (!file.endsWith('.ts')) continue;

    try {
      const {
        default: { options: event },
      }: { default: Event } = await import('file://' + path + file);

      if (!event?.name) continue;

      if (event.once) client.once(event.name, (...args: any[]) => event.execute(client, ...args));
      else client.on(event.name, (...args: any[]) => event.execute(client, ...args));
    } catch (err) {
      logger.error({ err }, `Error while loading event (${file})`);
      continue;
    }
  }

  const endTime = performance.now();
  logger.info(`Loaded events (${Math.floor(endTime - startTime)}ms)`);
};
