import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { Snowflake } from 'discord.js';

import { getDb } from '~/database/client';
import { memberHistory } from '~/database/schema/memberHistory';

export type MemberHistoryRecord = InferSelectModel<typeof memberHistory>;
export type InsertMemberHistory = Omit<InferInsertModel<typeof memberHistory>, 'id' | 'joinedAt' | 'leftAt'>;

export const insertMemberJoin = async (data: InsertMemberHistory): Promise<MemberHistoryRecord> => {
  const db = getDb();
  const [row] = await db.insert(memberHistory).values(data).returning();
  return row;
};

export const recordMemberLeave = async (userId: Snowflake, at: Date = new Date()): Promise<void> => {
  const db = getDb();
  const [latest] = await db
    .select({ id: memberHistory.id })
    .from(memberHistory)
    .where(and(eq(memberHistory.userId, userId), isNull(memberHistory.leftAt)))
    .orderBy(desc(memberHistory.joinedAt))
    .limit(1);
  if (latest) {
    await db.update(memberHistory).set({ leftAt: at }).where(eq(memberHistory.id, latest.id));
  }
};

export const getLatestJoinRecord = async (userId: Snowflake): Promise<MemberHistoryRecord | undefined> => {
  const db = getDb();
  const [row] = await db.select().from(memberHistory).where(eq(memberHistory.userId, userId)).orderBy(desc(memberHistory.joinedAt)).limit(1);
  return row;
};

export const getRecentJoinsByCode = async (code: string, windowMs: number): Promise<number> => {
  const db = getDb();
  const since = new Date(Date.now() - windowMs);
  const [{ c }] = await db
    .select({ c: count() })
    .from(memberHistory)
    .where(and(eq(memberHistory.inviteCode, code), gte(memberHistory.joinedAt, since)));
  return Number(c);
};

export interface InviteCodeStat {
  code: string;
  inviterId: string | null;
  totalJoins: number;
  activeMembers: number;
}

export const getTopInviteCodes = async (limit = 10): Promise<InviteCodeStat[]> => {
  const db = getDb();
  const rows = await db
    .select({
      code: memberHistory.inviteCode,
      inviterId: sql<string | null>`min(${memberHistory.inviterId})`,
      totalJoins: count(),
      activeMembers: sql<number>`count(*) filter (where ${memberHistory.leftAt} is null)`,
    })
    .from(memberHistory)
    .groupBy(memberHistory.inviteCode)
    .orderBy(desc(count()))
    .limit(limit);
  return rows.map((r) => ({
    code: r.code,
    inviterId: r.inviterId ?? null,
    totalJoins: Number(r.totalJoins),
    activeMembers: Number(r.activeMembers),
  }));
};
