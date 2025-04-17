import { ApplicationCommandType } from 'discord.js';

import { Logger, Client } from '~/models';
import { CommandOptions, InteractionType } from '~/types';

export class Command<T extends ApplicationCommandType = ApplicationCommandType.ChatInput> {
  public readonly options: CommandOptions<T>;
  public readonly logger: Readonly<Logger>;

  constructor(options: CommandOptions<T>) {
    this.options = options;
    this.logger = Logger.getInstance(options.feature);
  }

  public async execute(client: Client, interaction: InteractionType<T>) {
    const { executeCommand, middleware } = this.options;

    middleware?.forEach((apply) => this.execute.bind(apply(this, client, interaction)));
    await executeCommand(client, interaction);
  }
}
