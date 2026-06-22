import { and, count, eq, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { eventRegistrations } from '~/database/schema/eventRegistrations';

export type EventRegistration = InferSelectModel<typeof eventRegistrations>;

export const registerForEvent = async (eventId: number, userId: string): Promise<EventRegistration | undefined> => {
  const db = getDb();
  const [row] = await db.insert(eventRegistrations).values({ eventId, userId }).onConflictDoNothing().returning();
  return row;
};

export const unregisterFromEvent = async (eventId: number, userId: string): Promise<boolean> => {
  const db = getDb();
  const deleted = await db
    .delete(eventRegistrations)
    .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)))
    .returning();
  return deleted.length > 0;
};

export const isRegistered = async (eventId: number, userId: string): Promise<boolean> => {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(eventRegistrations)
    .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)));
  return Number(row.value) > 0;
};

export const listRegistrationsForEvent = async (eventId: number): Promise<EventRegistration[]> => {
  const db = getDb();
  return db.select().from(eventRegistrations).where(eq(eventRegistrations.eventId, eventId));
};

export const countRegistrationsForEvent = async (eventId: number): Promise<number> => {
  const db = getDb();
  const [row] = await db.select({ value: count() }).from(eventRegistrations).where(eq(eventRegistrations.eventId, eventId));
  return Number(row.value);
};

export const deleteRegistrationsForEvent = async (eventId: number): Promise<number> => {
  const db = getDb();
  const deleted = await db.delete(eventRegistrations).where(eq(eventRegistrations.eventId, eventId)).returning();
  return deleted.length;
};
