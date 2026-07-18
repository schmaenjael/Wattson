import type { Locale } from 'discord.js';
import { Cron } from 'croner';

import {
  cancelEvent,
  deleteRegistrationsForEvent,
  findEventById,
  isRegistered,
  listRegistrationsForEvent,
  registerForEvent,
  type Event,
  type Settings,
} from '~/database';
import type { Client } from '~/core/models';
import { L } from '~/core/locales';
import { attempt, discordTimestamp } from '~/utilities';

export const toUtc = (dateStr: string, timeStr: string, tz: string): Date => {
  const local = new Date(`${dateStr}T${timeStr}:00`);
  const inTz = new Date(local.toLocaleString('en-US', { timeZone: tz }));
  return new Date(local.getTime() + (local.getTime() - inTz.getTime()));
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

/** Strict parse for /event create: date/time format must match before attempting timezone conversion. */
export const parseNewEventSchedule = (dateStr: string, timeStr: string, tz: string): Date | null => {
  if (!DATE_REGEX.test(dateStr) || !TIME_REGEX.test(timeStr)) return null;
  try {
    const scheduledAt = toUtc(dateStr, timeStr, tz);
    if (isNaN(scheduledAt.getTime())) return null;
    return scheduledAt;
  } catch {
    return null;
  }
};

/**
 * Resolves /event recreate's schedule: any of date/time/tz may be omitted, falling back to the
 * original event's own values. No format pre-check (matches the original inline behavior).
 */
export const resolveRecreateSchedule = (original: Event, dateStr: string | null, timeStr: string | null, tz: string | null): Date | null => {
  if (!dateStr && !timeStr) return original.scheduledAt;

  const resolvedDate = dateStr ?? original.scheduledAt.toISOString().slice(0, 10);
  const resolvedTime =
    timeStr ?? `${String(original.scheduledAt.getUTCHours()).padStart(2, '0')}:${String(original.scheduledAt.getUTCMinutes()).padStart(2, '0')}`;
  const resolvedTz = tz ?? 'UTC';

  try {
    const scheduledAt = toUtc(resolvedDate, resolvedTime, resolvedTz);
    if (isNaN(scheduledAt.getTime())) return null;
    return scheduledAt;
  } catch {
    return null;
  }
};

export const isValidCron = (cronStr: string): boolean => {
  try {
    new Cron(cronStr);
    return true;
  } catch {
    return false;
  }
};

export const isEventManager = (memberRoleIds: Set<string>, roleEventManagerId: string | null): boolean =>
  roleEventManagerId !== null && memberRoleIds.has(roleEventManagerId);

/** Ownership check for a specific event: creator, or holds a moderation/event-manager role. */
export const canManageEvent = (
  creatorId: string | null,
  userId: string,
  memberRoleIds: Set<string>,
  settings: { roleEventManagerId: string | null; roleModerationId: string | null }
): boolean => {
  if (creatorId === userId) return true;
  if (settings.roleModerationId && memberRoleIds.has(settings.roleModerationId)) return true;
  if (settings.roleEventManagerId && memberRoleIds.has(settings.roleEventManagerId)) return true;
  return false;
};

/** Gate for the create/recreate/repeat/dashboard/cancel/attendees subcommands as a group. */
export const canManageEventsAtAll = (memberRoleIds: Set<string>, settings: Settings): boolean =>
  isEventManager(memberRoleIds, settings.roleEventManagerId) ||
  memberRoleIds.has(settings.roleModerationId ?? '') ||
  memberRoleIds.has(settings.roleAdministrationId ?? '');

/** Registers a user for each eligible (not cancelled, not past, not already-registered) event ID. Returns count signed up. */
export const signupForEvents = async (eventIds: number[], userId: string): Promise<number> => {
  let signedUp = 0;
  for (const id of eventIds) {
    const ev = await findEventById(id);
    if (!ev || ev.cancelledAt || ev.scheduledAt <= new Date()) continue;
    const alreadyIn = await isRegistered(id, userId);
    if (!alreadyIn) {
      await registerForEvent(id, userId);
      signedUp++;
    }
  }
  return signedUp;
};

/** Cancels an event, drops all registrations, and best-effort DMs every registrant. Returns count notified. */
export const cancelEventAndNotify = async (client: Client, event: Event, locale: Locale): Promise<number> => {
  const registrations = await listRegistrationsForEvent(event.id);
  await cancelEvent(event.id);
  await deleteRegistrationsForEvent(event.id);

  let notified = 0;
  for (const reg of registrations) {
    const sent = await attempt(async () => {
      const user = await client.users.fetch(reg.userId);
      return user.send(L[locale].EVENT.COMMAND_CANCEL.DM_NOTIFY({ name: event.name, time: discordTimestamp(event.scheduledAt, 'F') }));
    });
    if (sent !== null) notified++;
  }
  return notified;
};
