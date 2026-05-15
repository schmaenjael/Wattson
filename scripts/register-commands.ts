import { REST, Routes } from 'discord.js';

import { getCommandsCollection } from '~/core/loaders';

const registerCommands = async () => {
  const commandsCollection = await getCommandsCollection();

  const { CLIENT_ID, GUILD_ID, TOKEN } = process.env;
  if (!CLIENT_ID || !GUILD_ID || !TOKEN) {
    console.error('register-commands: CLIENT_ID, GUILD_ID, and TOKEN must be set.');
    process.exit(1);
  }

  const rest = new REST().setToken(TOKEN);

  const guildBody = commandsCollection.filter(({ options }) => !options.global).map(({ options }) => options.data.toJSON());

  const globalBody = commandsCollection.filter(({ options }) => options.global).map(({ options }) => options.data.toJSON());

  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: guildBody });
    console.log(`Registered ${guildBody.length} guild-scoped commands for guild ${GUILD_ID}.`);

    if (globalBody.length > 0) {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: globalBody });
      console.log(`Registered ${globalBody.length} global commands.`);
    }
  } catch (error) {
    console.error({ error }, 'Failed to register commands');
    process.exit(1);
  }
};

await registerCommands();
