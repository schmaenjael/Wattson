import { and, asc, count, gt, gte, isNull, lte, eq, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { events } from '~/database/schema/events';

export type Event = InferSelectModel<typeof events>;
export type NewEvent = Omit<InferInsertModel<typeof events>, 'id' | 'createdAt'>;

export const createEvent = async (input: NewEvent): Promise<Event> => {
  const db = getDb();
  const [row] = await db.insert(events).values(input).returning();
  return row;
};

export const findEventById = async (id: number): Promise<Event | undefined> => {
  const db = getDb();
  const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return row;
};

export const updateEvent = async (id: number, patch: Partial<NewEvent>): Promise<Event | undefined> => {
  const db = getDb();
  const [row] = await db.update(events).set(patch).where(eq(events.id, id)).returning();
  return row;
};

export const cancelEvent = async (id: number): Promise<void> => {
  const db = getDb();
  await db.update(events).set({ cancelledAt: new Date() }).where(eq(events.id, id));
};

export const listUpcomingEvents = async (limit: number, offset: number): Promise<{ events: Event[]; total: number }> => {
  const db = getDb();
  const now = new Date();
  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(events)
      .where(and(gt(events.scheduledAt, now), isNull(events.cancelledAt)))
      .orderBy(asc(events.scheduledAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(events)
      .where(and(gt(events.scheduledAt, now), isNull(events.cancelledAt))),
  ]);
  return { events: rows, total: Number(total) };
};

export const listEventsByCreator = async (creatorId: string): Promise<Event[]> => {
  const db = getDb();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(events)
    .where(and(eq(events.creatorId, creatorId), gte(events.scheduledAt, cutoff)))
    .orderBy(asc(events.scheduledAt));
};

export const listAnnouncableEvents = async (windowMs: number): Promise<Event[]> => {
  const db = getDb();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMs);
  return db
    .select()
    .from(events)
    .where(and(gte(events.scheduledAt, now), lte(events.scheduledAt, windowEnd), isNull(events.announcedAt), isNull(events.cancelledAt)))
    .orderBy(asc(events.scheduledAt));
};

export const listEventsInRange = async (from: Date, to: Date): Promise<Event[]> => {
  const db = getDb();
  return db
    .select()
    .from(events)
    .where(and(gte(events.scheduledAt, from), lte(events.scheduledAt, to), isNull(events.cancelledAt)))
    .orderBy(asc(events.scheduledAt));
};

export const findNextRepeatInstance = async (parentEventId: number): Promise<Event | undefined> => {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .select()
    .from(events)
    .where(and(eq(events.parentEventId, parentEventId), gt(events.scheduledAt, now), isNull(events.cancelledAt)))
    .orderBy(asc(events.scheduledAt))
    .limit(1);
  return row;
};

export const setAnnouncedAt = async (id: number): Promise<void> => {
  const db = getDb();
  await db.update(events).set({ announcedAt: new Date() }).where(eq(events.id, id));
};
