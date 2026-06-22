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
  ButtonInteraction,
  AnySelectMenuInteraction,
  ModalSubmitInteraction,
  Interaction as DiscordInteraction,
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

/**
 * Declarative interaction dispatch for the central InteractionCreate event.
 * Each route is matched by `kind` plus, for component/modal routes, the first
 * `:`-segment of the customId (`name`). `rights` are enforced (OR semantics)
 * before the handler runs. The matched provider handler is the only logic
 * entrypoint — events stay free of business logic.
 */
export type InteractionRouteKind = 'command' | 'autocomplete' | 'button' | 'select' | 'modal';

interface CommandRoute {
  kind: 'command';
  handler: (client: Client, interaction: DiscordInteraction) => Promise<void>;
}

interface AutocompleteRoute {
  kind: 'autocomplete';
  handler: (client: Client, interaction: AutocompleteInteraction) => Promise<void>;
}

interface ButtonRoute {
  kind: 'button';
  name: string;
  rights?: Permission[];
  handler: (client: Client, interaction: ButtonInteraction) => Promise<void>;
}

interface SelectRoute {
  kind: 'select';
  name: string;
  rights?: Permission[];
  handler: (client: Client, interaction: AnySelectMenuInteraction) => Promise<void>;
}

interface ModalRoute {
  kind: 'modal';
  name: string;
  rights?: Permission[];
  handler: (client: Client, interaction: ModalSubmitInteraction) => Promise<void>;
}

export type InteractionRoute = CommandRoute | AutocompleteRoute | ButtonRoute | SelectRoute | ModalRoute;

/**
 * Fan-out handler for non-interaction gateway events. Each provider entrypoint receives the client
 * plus the raw event args and self-guards (own feature-flag / bot checks). The Event runs them in
 * declared order but isolates failures, so one throwing provider does not block the others.
 */
export type EventHandler<T extends keyof ClientEvents> = (client: Client, ...args: ClientEvents[T]) => Promise<void> | void;

export interface EventOptions<T extends keyof ClientEvents> extends Interaction {
  type: T;
  once?: boolean;
  middleware?: Array<MiddlewareFunctionEvent<T>>;
  afterware?: Array<AfterwareFunctionEvent<T>>;
  routes?: InteractionRoute[];
  handlers?: Array<EventHandler<T>>;
  executeCommand?(event: Event<T>, client: Client, ...args: ClientEvents[T]): Promise<unknown>;
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
