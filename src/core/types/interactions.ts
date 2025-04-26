import type {
  ApplicationCommandType,
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ContextMenuCommandBuilder,
  AutocompleteInteraction,
  ClientEvents,
} from 'discord.js';

import type { Client, Permission, Event, Command } from '~/core/models';
import type { AppFeature } from '~/settings';

export type InteractionType<CommandType extends ApplicationCommandType> = CommandType extends ApplicationCommandType.ChatInput
  ? ChatInputCommandInteraction
  : CommandType extends ApplicationCommandType.Message
    ? MessageContextMenuCommandInteraction
    : CommandType extends ApplicationCommandType.User
      ? UserContextMenuCommandInteraction
      : never;

type DataType<T extends ApplicationCommandType> = T extends ApplicationCommandType.ChatInput
  ?
      | SlashCommandBuilder
      | SlashCommandOptionsOnlyBuilder
      | SlashCommandSubcommandBuilder
      | SlashCommandSubcommandGroupBuilder
      | SlashCommandSubcommandsOnlyBuilder
  : ContextMenuCommandBuilder;

export type MiddlewareFunction<T> = T extends keyof ClientEvents
  ? MiddlewareFunctionEvent<T>
  : T extends ApplicationCommandType
    ? MiddlewareFunctionCommand<T>
    : never;

type MiddlewareFunctionEvent<T extends keyof ClientEvents> = (event: Event<T>, client: Client, ...args: ClientEvents[T]) => Promise<unknown>;

type MiddlewareFunctionCommand<T extends ApplicationCommandType> = (
  command: Command<T>,
  client: Client,
  interaction: InteractionType<T>
) => Promise<unknown>;

interface Interaction<T> {
  feature: AppFeature;
  requiredPermissions?: Permission[];
}

export interface EventOptions<T extends keyof ClientEvents> extends Interaction<T> {
  name: T;
  once?: boolean;
  middleware?: Array<MiddlewareFunctionEvent<T>>;
  executeCommand(client: Client, ...args: ClientEvents[T]): Promise<unknown>; //TODO
}

export interface CommandOptions<T extends ApplicationCommandType> extends Interaction<T> {
  data: DataType<T>;
  cooldown?: number;
  middleware?: Array<MiddlewareFunctionCommand<T>>;
  autocomplete?(client: Client, interaction: AutocompleteInteraction): unknown;
  executeCommand(command: Command<T>, client: Client, interaction: InteractionType<T>): Promise<unknown>;
}
