import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  InteractionType,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type MessageContextMenuCommandInteraction,
  type PermissionsString,
  type SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
  type SlashCommandSubcommandBuilder,
  type SlashCommandSubcommandGroupBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
  type UserContextMenuCommandInteraction,
} from 'discord.js';
import { AppFeature } from '~/constants';
import { Logger, Client, UInt8 } from '~/models';

interface CommandOptions<T extends ApplicationCommandType> {
  data: T extends ApplicationCommandType.ChatInput
    ?
        | SlashCommandBuilder
        | SlashCommandOptionsOnlyBuilder
        | SlashCommandSubcommandBuilder
        | SlashCommandSubcommandGroupBuilder
        | SlashCommandSubcommandsOnlyBuilder
    : ContextMenuCommandBuilder;
  feature: AppFeature;
  cooldown?: number;
  enabled?: boolean;
  botPermissions?: UInt8;
  autocomplete?({ client, interaction }: { client: Client; interaction: AutocompleteInteraction; lng: string }): unknown;
  execute({ client, interaction, lng }: { client: Client; interaction: InteractionType; lng: string }): unknown;
}

export class Command<T extends ApplicationCommandType = ApplicationCommandType.ChatInput> {
  public readonly options: CommandOptions<T>;
  public readonly logger: Readonly<Logger>;

  constructor(options: CommandOptions<T>) {
    this.options = options;
    this.logger = Logger.getInstance(options.feature);
  }
}
