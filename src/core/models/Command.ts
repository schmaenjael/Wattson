import { ApplicationCommandType } from 'discord.js';

import { CommandOptions, InteractionType, MiddlewareResult } from '~/core/types';
import { BotException, Client } from '~/core/models';
import { ProcessExitCode } from '~/settings';
import { Logger } from '~/utilities';

export class Command<T extends ApplicationCommandType = ApplicationCommandType.ChatInput> {
  public readonly options: CommandOptions<T>;
  public readonly logger: Readonly<Logger>;

  constructor(options: CommandOptions<T>) {
    this.options = options;
    this.logger = Logger.getInstance(options.feature);
  }

  public async execute(client: Client, interaction: InteractionType<T>) {
    const { executeCommand, middleware, afterware } = this.options;

    try {
      const results: Array<MiddlewareResult> = [];

      if (middleware) {
        for (const fn of middleware) {
          const result = await fn(this, client, interaction);
          results.push(result);
          if (result.status !== ProcessExitCode.OK) {
            this.logger.debug({ command: interaction.commandName, status: result.status }, 'Middleware short-circuited command execution.');
            return;
          }
        }
      }

      const commandResult = await executeCommand(this, client, interaction, results);

      if (afterware) {
        for (const fn of afterware) {
          await fn(this, client, interaction, results, commandResult);
        }
      }
    } catch (error: unknown) {
      throw new BotException(client, `${interaction.commandName} by ${interaction.user.username}`, error);
    }
  }
}
