import { ApplicationCommandType } from 'discord.js';

import type { AfterwareFunctionCommand } from '~/core/types';
import { recordAuditEvent, type AuditEntry } from '~/database';

const isAuditEntry = (value: unknown): value is AuditEntry => typeof value === 'object' && value !== null && 'eventType' in value;

export const logModAction: AfterwareFunctionCommand<ApplicationCommandType.ChatInput> = async (
  _command,
  _client,
  _interaction,
  _middlewareData,
  commandResult
) => {
  if (!isAuditEntry(commandResult)) return;
  await recordAuditEvent(commandResult);
};
