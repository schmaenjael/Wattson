import { Client as _Client, ClientOptions, Collection, Partials } from 'discord.js';

import { Logger, Command } from '~/models';
import { loadEvents, loadCommands } from '~/loaders';

import { config } from 'bot.config';
import { measurePerformance } from '~/utilities/measurePerformance';

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

  public setCommands(commands: Collection<string, Command>) {
    this.commands = commands;
  }

  public getCommands() {
    return Object.freeze(this.commands);
  }

  public start() {
    Promise.allSettled([loadEvents(this), loadCommands(this)])
      .then(() =>
        this.login(process.env.TOKEN).then(() =>
          Logger.getInstance().info(`Successfully initialized bot <@${process.env.APPLICATION_ID}>.`)
        )
      )
      .catch((err) => Logger.getInstance().fatal(Object(err), `Failed to start the server, due to an error.`));
  }
}
