import { Client as _Client, ActivityType, ApplicationCommandType, ClientOptions, Collection, GatewayIntentBits, Partials } from 'discord.js';

import { loadEvents, loadSlashCommands } from '~/core/loaders';
import { Logger, measurePerformance } from '~/utilities';
import { Command } from '~/core/models';

export class Client extends _Client {
  private static instance: Client | null = null;
  private commands = new Collection<string, Command<ApplicationCommandType>>();

  private constructor() {
    super({
      intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
      ],
      presence: { status: 'dnd', activities: [{ name: 'Keeping the server tidy.. 🧹', type: ActivityType.Watching }] },
      rest: { rejectOnRateLimit: async () => true, version: '10' },
      partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction, Partials.User],
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

  public async start(): Promise<void> {
    await Promise.all([measurePerformance(() => loadEvents(this), 'events')(), measurePerformance(() => loadSlashCommands(this), 'commands')()]);
    await this.login(process.env.TOKEN);
    Logger.getInstance().info(`Successfully initialized bot <@${process.env.APPLICATION_ID}>.`);
  }
}
