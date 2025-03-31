import { Collection } from 'discord.js';

import { SlashCommand } from '~/models/discord';

import ping from './ping';

export const commandsCollection = new Collection<string, SlashCommand>();
commandsCollection.set(ping.data.name, ping);
