import { ClientEvents, Interaction, MessageFlags } from 'discord.js';

import { EventOptions, InteractionRoute, InteractionRouteKind, MiddlewareResult } from '~/core/types';
import { Client } from '~/core/models';
import { Permission } from '~/core/models/Permission';
import { memberHasAnyPermission } from '~/core/middleware/permissionCore';
import { getSettings } from '~/database';
import { L } from '~/core/locales';
import { ProcessExitCode } from '~/settings';
import { Logger } from '~/utilities';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Event<T extends keyof ClientEvents = any> {
  public readonly options: EventOptions<T>;
  public readonly logger: Readonly<Logger>;

  private readonly routeIndex: Map<string, InteractionRoute>;

  constructor(options: EventOptions<T>) {
    this.options = options;
    this.logger = Logger.getInstance(options.feature);
    this.routeIndex = this.indexRoutes(options.routes ?? []);
  }

  public async execute(client: Client, ...args: ClientEvents[T]) {
    const { middleware, afterware } = this.options;

    if (middleware) {
      for (const fn of middleware) {
        const result: MiddlewareResult = await fn(this, client, ...args);
        if (result.status !== ProcessExitCode.OK) {
          this.logger.debug({ event: this.options.type, status: result.status }, 'Middleware short-circuited event handler.');
          return;
        }
      }
    }

    if (this.options.routes) {
      await this.dispatchRoutes(client, args[0] as Interaction);
    } else if (this.options.handlers) {
      for (const handler of this.options.handlers) {
        try {
          await handler(client, ...args);
        } catch (err) {
          this.logger.error(Object(err), `Event handler failed for ${this.options.type}`);
        }
      }
    }

    if (afterware) {
      for (const fn of afterware) {
        await fn(this, client, ...args);
      }
    }
  }

  private indexRoutes(routes: InteractionRoute[]): Map<string, InteractionRoute> {
    const index = new Map<string, InteractionRoute>();
    for (const route of routes) {
      index.set(this.routeKey(route.kind, 'name' in route ? route.name : undefined), route);
    }
    return index;
  }

  private routeKey(kind: InteractionRouteKind, name?: string): string {
    return name === undefined ? kind : `${kind}:${name}`;
  }

  private resolveKind(interaction: Interaction): InteractionRouteKind | null {
    if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) return 'command';
    if (interaction.isAutocomplete()) return 'autocomplete';
    if (interaction.isButton()) return 'button';
    if (interaction.isAnySelectMenu()) return 'select';
    if (interaction.isModalSubmit()) return 'modal';
    return null;
  }

  private async dispatchRoutes(client: Client, interaction: Interaction): Promise<void> {
    const kind = this.resolveKind(interaction);
    if (!kind) return;

    const name = 'customId' in interaction ? interaction.customId.split(':')[0] : undefined;
    const route = this.routeIndex.get(this.routeKey(kind, name));
    if (!route) return;

    if ('rights' in route && route.rights && !(await this.passesRights(interaction, route.rights))) {
      return;
    }

    // Cast is safe: `kind` matched the route's discriminant via the index key.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await route.handler(client, interaction as any);
  }

  private async passesRights(interaction: Interaction, rights: Permission[]): Promise<boolean> {
    if (interaction.user.id === process.env.ADMIN_USER_ID) return true;

    const member = (await interaction.guild?.members.fetch(interaction.user.id).catch(() => null)) ?? null;
    const settings = await getSettings();

    if (member && memberHasAnyPermission(member, settings, rights)) return true;

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: L[interaction.locale].GENERAL.COMMAND_INVALID_PERMISSIONS(), flags: MessageFlags.Ephemeral });
    }
    return false;
  }
}
