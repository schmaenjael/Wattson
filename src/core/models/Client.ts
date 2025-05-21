import { Client as _Client, ActivityType, ApplicationCommandType, ClientOptions, Collection, GatewayIntentBits, Partials } from 'discord.js';

import { loadEvents, loadSlashCommands, loadTextCommands } from '~/core/loaders';
import { Logger, Utils } from '~/utilities';
import { Command } from '~/core/models';
import DatabaseClient from '~/database';

export class Client extends _Client {
  private static instance: Client | null = null;
  private commands = new Collection<string, Command<ApplicationCommandType>>();

  private constructor() {
    super({
      intents: [
        GatewayIntentBits.AutoModerationConfiguration,
        GatewayIntentBits.AutoModerationExecution,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildExpressions,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessagePolls,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
      ],
      presence: { status: 'dnd', activities: [{ name: 'Keeping the server tidy.. 🧹', type: ActivityType.Watching }] },
      rest: { rejectOnRateLimit: async () => true, version: '10' },
      partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.GuildScheduledEvent,
        Partials.Message,
        Partials.Reaction,
        Partials.ThreadMember,
        Partials.User,
      ],
    } satisfies ClientOptions);
  }

  public static getInstance() {
    if (this.instance == null) this.instance = new Client();
    return this.instance;
  }

  public setCommands(commands: Collection<string, Command<ApplicationCommandType>>) {
    this.commands = Object.freeze(commands);
  }

  public getCommands() {
    return this.commands;
  }

  public start() {
    Promise.all([Utils.measurePerformance(() => loadEvents(this), 'events')(), Utils.measurePerformance(() => loadSlashCommands(this), 'commands')()])
      .then(() =>
        this.login(process.env.TOKEN).then(() => Logger.getInstance().info(`Successfully initialized bot <@${process.env.APPLICATION_ID}>.`))
      )
      .catch((error) => Logger.getInstance().fatal(Object(error), `Failed to start the server, due to an error.`));
  }
}
