import { ClientEvents, Interaction } from 'discord.js';

import { Logger, Client } from '~/models';
import { EventOptions } from '~/types';

export class Event<T extends keyof ClientEvents = any> {
  public readonly options: EventOptions<T>;
  public readonly logger: Readonly<Logger>;

  constructor(options: EventOptions<T>) {
    this.options = options;
    this.logger = Logger.getInstance(options.feature);
  }

  public async execute(client: Client, ...args: ClientEvents[T]) {
    const { executeCommand, middleware } = this.options;

    middleware?.forEach((apply) => this.execute.bind(apply(this, client, ...args)));

    await executeCommand(client, ...args);
  }
}
