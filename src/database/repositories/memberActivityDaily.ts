import { count, countDistinct, desc, eq, gte, sql, sum, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { memberActivityDaily } from '~/database/schema/memberActivityDaily';

export type MemberActivityDaily = InferSelectModel<typeof memberActivityDaily>;

export interface ActivityDelta {
  userId: string;
  day: string;
  messageDelta: number;
  voiceDelta: number;
  reactionDelta: number;
}

export interface EngagementTotals {
  messages: number;
  voiceSeconds: number;
  reactions: number;
  activeMembers: number;
}

export interface DailyActivityBucket {
  day: string;
  messages: number;
  voiceSeconds: number;
  reactions: number;
  activeMembers: number;
}

export const flushActivityDeltas = async (deltas: ActivityDelta[]): Promise<void> => {
  if (deltas.length === 0) {
    return;
  }
  const db = getDb();
  await db
    .insert(memberActivityDaily)
    .values(
      deltas.map((d) => ({ userId: d.userId, day: d.day, messageCount: d.messageDelta, voiceSeconds: d.voiceDelta, reactionCount: d.reactionDelta }))
    )
    .onConflictDoUpdate({
      target: [memberActivityDaily.userId, memberActivityDaily.day],
      set: {
        messageCount: sql`${memberActivityDaily.messageCount} + excluded.message_count`,
        voiceSeconds: sql`${memberActivityDaily.voiceSeconds} + excluded.voice_seconds`,
        reactionCount: sql`${memberActivityDaily.reactionCount} + excluded.reaction_count`,
      },
    });
};

export const getActiveUserCount = async (since: string): Promise<number> => {
  const db = getDb();
  const [{ c }] = await db
    .select({ c: countDistinct(memberActivityDaily.userId) })
    .from(memberActivityDaily)
    .where(gte(memberActivityDaily.day, since));
  return Number(c);
};

export const getMessageCountForDay = async (day: string): Promise<number> => {
  const db = getDb();
  const [{ total }] = await db
    .select({ total: sum(memberActivityDaily.messageCount) })
    .from(memberActivityDaily)
    .where(eq(memberActivityDaily.day, day));
  return Number(total ?? 0);
};

export const getEngagementTotals = async (since: string): Promise<EngagementTotals> => {
  const db = getDb();
  const [totals] = await db
    .select({
      messages: sum(memberActivityDaily.messageCount),
      voiceSeconds: sum(memberActivityDaily.voiceSeconds),
      reactions: sum(memberActivityDaily.reactionCount),
      activeMembers: countDistinct(memberActivityDaily.userId),
    })
    .from(memberActivityDaily)
    .where(gte(memberActivityDaily.day, since));
  return {
    messages: Number(totals?.messages ?? 0),
    voiceSeconds: Number(totals?.voiceSeconds ?? 0),
    reactions: Number(totals?.reactions ?? 0),
    activeMembers: Number(totals?.activeMembers ?? 0),
  };
};

export const getTopByMessages = async (since: string, limit = 10): Promise<{ userId: string; messages: number }[]> => {
  const db = getDb();
  const rows = await db
    .select({ userId: memberActivityDaily.userId, messages: sum(memberActivityDaily.messageCount) })
    .from(memberActivityDaily)
    .where(gte(memberActivityDaily.day, since))
    .groupBy(memberActivityDaily.userId)
    .orderBy(desc(sum(memberActivityDaily.messageCount)))
    .limit(limit);
  return rows.map((r) => ({ userId: r.userId, messages: Number(r.messages) }));
};

export const getDailyActivitySeries = async (since: string): Promise<DailyActivityBucket[]> => {
  const db = getDb();
  const rows = await db
    .select({
      day: memberActivityDaily.day,
      messages: sum(memberActivityDaily.messageCount),
      voiceSeconds: sum(memberActivityDaily.voiceSeconds),
      reactions: sum(memberActivityDaily.reactionCount),
      activeMembers: count(),
    })
    .from(memberActivityDaily)
    .where(gte(memberActivityDaily.day, since))
    .groupBy(memberActivityDaily.day)
    .orderBy(memberActivityDaily.day);
  return rows.map((r) => ({
    day: r.day,
    messages: Number(r.messages),
    voiceSeconds: Number(r.voiceSeconds),
    reactions: Number(r.reactions),
    activeMembers: Number(r.activeMembers),
  }));
};
