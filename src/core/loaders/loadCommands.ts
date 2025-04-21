import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Collection } from 'discord.js';

import { Client, Command } from '~/core/models';
import { LOADABLE_FILETYPES } from '~/settings';
import { Logger } from '~/utilities';

export const getCommandsCollection = async () => {
  const logger = Logger.getInstance();
  const path = join(process.cwd(), 'src/core/commands');

  const commands = new Collection<string, Command<any>>();

  try {
    const files = await readdir(path, { recursive: true });

    for (const file of files) {
      if (!LOADABLE_FILETYPES.includes(extname(file))) continue;
      const filePath = join(path, file);

      try {
        const { default: command }: { default: Command } = await import(pathToFileURL(filePath).href);
        const { data } = command.options;

        commands.set(data.name, command);

        logger.debug(`Loaded command <${data.name}> from ${filePath}`);
      } catch (error) {
        logger.error({ error }, `Failed to load command ${file} from ${filePath}`);
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to read commands directory');
  }

  return commands;
};

export async function loadCommands(client: Client) {
  const commands = await getCommandsCollection();
  client.setCommands(commands);
}
