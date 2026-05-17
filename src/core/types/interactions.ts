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
import type { AppFeature, ProcessExitCode } from '~/settings';

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

type MiddlewareFunctionEvent<T extends keyof ClientEvents> = (event: Event<T>, client: Client, ...args: ClientEvents[T]) => Promise<MiddlewareResult>;

type MiddlewareFunctionCommand<T extends ApplicationCommandType> = (
  command: Command<T>,
  client: Client,
  interaction: InteractionType<T>
) => Promise<MiddlewareResult>;

export type AfterwareFunction<T> = T extends keyof ClientEvents
  ? AfterwareFunctionEvent<T>
  : T extends ApplicationCommandType
    ? AfterwareFunctionCommand<T>
    : never;

export type AfterwareFunctionEvent<T extends keyof ClientEvents> = (event: Event<T>, client: Client, ...args: ClientEvents[T]) => Promise<void>;

export type AfterwareFunctionCommand<T extends ApplicationCommandType> = (
  command: Command<T>,
  client: Client,
  interaction: InteractionType<T>,
  middlewareData: Array<MiddlewareResult>,
  commandResult: unknown
) => Promise<void>;

interface Interaction {
  feature: AppFeature;
  requiredPermissions?: Permission[];
  allowDM?: boolean;
  dmOnly?: boolean;
}

export interface EventOptions<T extends keyof ClientEvents> extends Interaction {
  type: T;
  once?: boolean;
  middleware?: Array<MiddlewareFunctionEvent<T>>;
  afterware?: Array<AfterwareFunctionEvent<T>>;
  executeCommand(event: Event<T>, client: Client, ...args: ClientEvents[T]): Promise<unknown>;
}

export interface MiddlewareResult {
  status: ProcessExitCode;
  payload?: unknown;
}

export interface CommandOptions<T extends ApplicationCommandType> extends Interaction {
  type: T;
  global?: boolean;
  data: DataType<T>;
  cooldown?: number;
  middleware?: Array<MiddlewareFunctionCommand<T>>;
  afterware?: Array<AfterwareFunctionCommand<T>>;
  autocomplete?(client: Client, interaction: AutocompleteInteraction): unknown;
  executeCommand(command: Command<T>, client: Client, interaction: InteractionType<T>, middlewareData: Array<MiddlewareResult>): Promise<unknown>;
}
