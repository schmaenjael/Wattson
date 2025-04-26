import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { LOADABLE_FILETYPES } from '~/settings';
import { Client, Event } from '~/core/models';
import { Logger } from '~/utilities';

export const loadEvents = async (client: Client) => {
  const logger = Logger.getInstance();
  const path = join(process.cwd(), 'src/core/events');

  try {
    const files = await readdir(path, { recursive: true });

    for (const file of files) {
      if (!LOADABLE_FILETYPES.includes(extname(file))) continue;
      const filePath = join(path, file);

      try {
        const { default: event }: { default: Event } = await import(pathToFileURL(filePath).href);
        const { name, once } = event.options;

        if (once) client.once(name, (...args: unknown[]) => event.execute(client, ...args));
        else client.on(name, (...args: unknown[]) => event.execute(client, ...args));

        logger.debug(`Loaded event <${name}> from ${filePath}`);
      } catch (error) {
        logger.error({ error }, `Failed to load event ${file} from ${filePath}`);
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to read events directory');
  }
};
