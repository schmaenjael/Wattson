import { ClientEvents } from 'discord.js';

import { EventOptions, MiddlewareResult } from '~/core/types';
import { Client } from '~/core/models';
import { ProcessExitCode } from '~/settings';
import { Logger } from '~/utilities';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Event<T extends keyof ClientEvents = any> {
  public readonly options: EventOptions<T>;
  public readonly logger: Readonly<Logger>;

  constructor(options: EventOptions<T>) {
    this.options = options;
    this.logger = Logger.getInstance(options.feature);
  }

  public async execute(client: Client, ...args: ClientEvents[T]) {
    const { executeCommand, middleware, afterware } = this.options;

    if (middleware) {
      for (const fn of middleware) {
        const result: MiddlewareResult = await fn(this, client, ...args);
        if (result.status !== ProcessExitCode.OK) {
          this.logger.debug({ event: this.options.type, status: result.status }, 'Middleware short-circuited event handler.');
          return;
        }
      }
    }

    await executeCommand(this, client, ...args);

    if (afterware) {
      for (const fn of afterware) {
        await fn(this, client, ...args);
      }
    }
  }
}
