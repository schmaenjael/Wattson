import { REST, RESTPostAPIApplicationCommandsJSONBody, Routes } from 'discord.js';
import { commandsCollection } from '~/handlers/commands';

const commands: Array<RESTPostAPIApplicationCommandsJSONBody> = commandsCollection.map(({ data }) => data.toJSON());

const rest = new REST().setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data: any = await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

    console.log(data);

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
