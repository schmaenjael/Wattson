import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Client, Command, Logger } from '~/models';
import { LOADABLE_FILETYPES } from '~/constants';
import { Collection } from 'discord.js';

export const getCommandsCollection = async () => {
  const logger = Logger.getInstance();
  const path = join(process.cwd(), 'src/commands');

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
      } catch (err) {
        logger.error({ err }, `Failed to load command ${file} from ${filePath}`);
      }
    }
  } catch (err) {
    logger.error({ err }, 'Failed to read commands directory');
  }

  return commands;
};

export async function loadCommands(client: Client) {
  const commands = await getCommandsCollection();
  client.setCommands(commands);
}
