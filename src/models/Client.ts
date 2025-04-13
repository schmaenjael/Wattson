import { Client as _Client, ClientOptions, Collection, Partials } from 'discord.js';

import { Command } from './Command';
import { Logger } from '~/models';

import { config } from 'bot.config';
import { loadEvents } from '~/loaders/loadEvents';

export class Client extends _Client {
  private static instance: Client | null = null;
  private commands = new Collection<string, Command>();

  private constructor() {
    super({
      intents: config.intents,
      presence: config.presence,
      rest: { rejectOnRateLimit: async () => true, version: '10' },
      partials: config.partials
        ? [
            Partials.Channel,
            Partials.GuildMember,
            Partials.GuildScheduledEvent,
            Partials.Message,
            Partials.Reaction,
            Partials.ThreadMember,
            Partials.User,
          ]
        : [],
    } satisfies ClientOptions);
  }

  public static getInstance() {
    if (this.instance == null) this.instance = new Client();
    return this.instance;
  }

  public start() {
    Promise.allSettled([this.login(process.env.TOKEN), loadEvents(this)])
      .then(() => Logger.getInstance().info(`Successfully initialized bot <@${process.env.APPLICATION_ID}>.`))
      .catch((err) => Logger.getInstance().fatal(Object(err), `Failed to start the server, due to an error.`));
  }
}
