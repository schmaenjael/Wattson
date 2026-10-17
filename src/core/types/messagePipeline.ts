import type { Message } from 'discord.js';

import type { Settings } from '~/database';
import type { Client } from '~/core/models';
import type { Logger } from '~/utilities';

export interface MessageContext {
  client: Client;
  message: Message<true>;
  settings: Settings;
  logger: Logger;
}

export type PipelineStep = (ctx: MessageContext) => Promise<boolean | void>;
