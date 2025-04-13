import { ClientEvents } from 'discord.js';
import { Client } from './Client';
import { AbilityCategories, AppFeature, appFeatureMap, SystemCategories } from '~/constants';
import { Logger } from './Logger';

export { Events } from 'discord.js';

interface EventOptions<T extends keyof ClientEvents> {
  name: T;
  feature: AppFeature;
  once?: boolean;
  enabled?: boolean;
  middleware?: Array<() => Promise<void>>;
  execute(client: Client, ...args: ClientEvents[T]): unknown;
}

export class Event<T extends keyof ClientEvents = any> {
  public readonly options: EventOptions<T>;
  public readonly logger: Readonly<Logger>;

  constructor(options: EventOptions<T>) {
    this.options = options;
    this.logger = Logger.getInstance(options.feature);
  }
}
