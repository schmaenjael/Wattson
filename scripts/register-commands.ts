import {
  APIApplicationCommandSubcommandGroupOption,
  APIApplicationCommandSubcommandOption,
  REST,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
  Routes,
} from 'discord.js';

import { getCommandsCollection } from '~/loaders';

const registerCommands = async () => {
  const commandsCollection = await getCommandsCollection();
  const commands: (
    | RESTPostAPIChatInputApplicationCommandsJSONBody
    | APIApplicationCommandSubcommandOption
    | APIApplicationCommandSubcommandGroupOption
    | RESTPostAPIContextMenuApplicationCommandsJSONBody
  )[] = commandsCollection.map(({ options }) => options.data.toJSON());

  await new REST()
    .setToken(process.env.TOKEN)
    .put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
    .catch((error) => console.error({ error }, 'Failed to register commands'))
    .then(() => console.log(`Registered ${commands.length} global application commands`));
};

await registerCommands();
