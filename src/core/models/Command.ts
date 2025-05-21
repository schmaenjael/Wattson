import { ApplicationCommandType } from 'discord.js';

import { CommandOptions, InteractionType } from '~/core/types';
import { Client, RecoverableException } from '~/core/models';
import { Logger } from '~/utilities';

export class Command<T extends ApplicationCommandType = ApplicationCommandType.ChatInput> {
  public readonly options: CommandOptions<T>;
  public readonly logger: Readonly<Logger>;

  constructor(options: CommandOptions<T>) {
    this.options = options;
    this.logger = Logger.getInstance(options.feature);
  }

  public async execute(client: Client, interaction: InteractionType<T>) {
    const { executeCommand, middleware } = this.options;

    try {
      middleware?.forEach((apply) => this.execute.bind(apply(this, client, interaction)));
      await executeCommand(this, client, interaction);
    } catch (error: unknown) {
      /* No matter which code arrives this position, it will always be a non-fatal error, thus error handling can be promted to the respective layer */
      throw new RecoverableException(client, `${interaction.commandName} by ${interaction.user.username}`, error);
    }
  }
}
