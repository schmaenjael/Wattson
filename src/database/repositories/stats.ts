import { and, count, eq, gte, sql } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { auditLog } from '~/database/schema/auditLog';
import { bans } from '~/database/schema/bans';
import { reports } from '~/database/schema/reports';
import { warnings } from '~/database/schema/warnings';
import { AuditEventType, ReportStatus } from '~/database/schema/enums';
import { memberHistory } from '~/database/schema/memberHistory';
import { getTopInviteCodes, type InviteCodeStat } from './memberHistory';

export type { InviteCodeStat };

export interface InviteStats {
  topCodes: InviteCodeStat[];
  totalTrackedJoins: number;
}

export const getInviteStats = async (limit = 5): Promise<InviteStats> => {
  const db = getDb();
  const [[{ total }], topCodes] = await Promise.all([db.select({ total: count() }).from(memberHistory), getTopInviteCodes(limit)]);
  return { topCodes, totalTrackedJoins: Number(total) };
};

export interface JoinStats {
  joins: number;
  leaves: number;
  net: number;
}

export interface ModerationStats {
  warnings: number;
  bans: number;
  reports: { total: number; open: number };
}

export interface ActivityStats {
  automodTriggered: number;
  messagesDeleted: number;
  messagesEdited: number;
  verificationsStarted: number;
  verificationsCompleted: number;
}

export const getJoinStats = async (since: Date): Promise<JoinStats> => {
  const db = getDb();
  const [[{ joins }], [{ leaves }]] = await Promise.all([
    db
      .select({ joins: count() })
      .from(auditLog)
      .where(and(eq(auditLog.eventType, AuditEventType.MemberJoined), gte(auditLog.createdAt, since))),
    db
      .select({ leaves: count() })
      .from(auditLog)
      .where(and(eq(auditLog.eventType, AuditEventType.MemberLeft), gte(auditLog.createdAt, since))),
  ]);
  return { joins: Number(joins), leaves: Number(leaves), net: Number(joins) - Number(leaves) };
};

export const getModerationStats = async (since: Date): Promise<ModerationStats> => {
  const db = getDb();
  const [[{ w }], [{ b }], [{ rTotal }], [{ rOpen }]] = await Promise.all([
    db.select({ w: count() }).from(warnings).where(gte(warnings.createdAt, since)),
    db.select({ b: count() }).from(bans).where(gte(bans.createdAt, since)),
    db.select({ rTotal: count() }).from(reports).where(gte(reports.createdAt, since)),
    db
      .select({ rOpen: count() })
      .from(reports)
      .where(and(gte(reports.createdAt, since), eq(reports.status, ReportStatus.Open))),
  ]);
  return { warnings: Number(w), bans: Number(b), reports: { total: Number(rTotal), open: Number(rOpen) } };
};

export const getActivityStats = async (since: Date): Promise<ActivityStats> => {
  const db = getDb();
  const countByType = async (type: AuditEventType): Promise<number> => {
    const [{ c }] = await db
      .select({ c: count() })
      .from(auditLog)
      .where(and(eq(auditLog.eventType, type), gte(auditLog.createdAt, since)));
    return Number(c);
  };

  const [automodTriggered, messagesDeleted, messagesEdited, verificationsStarted, verificationsCompleted] = await Promise.all([
    countByType(AuditEventType.AutomodTriggered),
    countByType(AuditEventType.MessageDeleted),
    countByType(AuditEventType.MessageEdited),
    countByType(AuditEventType.VerificationStarted),
    countByType(AuditEventType.VerificationCompleted),
  ]);

  return { automodTriggered, messagesDeleted, messagesEdited, verificationsStarted, verificationsCompleted };
};

export interface MonthlyVerificationBucket {
  month: string;
  completed: number;
  rejected: number;
}

export interface MonthlyModerationBucket {
  month: string;
  warnings: number;
  bans: number;
  reports: number;
}

/** Monthly verifications (completed vs rejected) for the last N months, oldest → newest. */
export const getMonthlyVerifications = async (months: number): Promise<MonthlyVerificationBucket[]> => {
  const db = getDb();
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const monthLabel = sql<string>`to_char(date_trunc('month', ${auditLog.createdAt}), 'YYYY-MM')`;

  const completed = await db
    .select({ month: monthLabel, c: count() })
    .from(auditLog)
    .where(and(eq(auditLog.eventType, AuditEventType.VerificationCompleted), gte(auditLog.createdAt, since)))
    .groupBy(sql`date_trunc('month', ${auditLog.createdAt})`)
    .orderBy(sql`date_trunc('month', ${auditLog.createdAt})`);

  const rejected = await db
    .select({ month: monthLabel, c: count() })
    .from(auditLog)
    .where(and(eq(auditLog.eventType, AuditEventType.VerificationRejected), gte(auditLog.createdAt, since)))
    .groupBy(sql`date_trunc('month', ${auditLog.createdAt})`)
    .orderBy(sql`date_trunc('month', ${auditLog.createdAt})`);

  const allMonths = new Set([...completed.map((r) => r.month), ...rejected.map((r) => r.month)]);
  const completedMap = new Map(completed.map((r) => [r.month, Number(r.c)]));
  const rejectedMap = new Map(rejected.map((r) => [r.month, Number(r.c)]));

  return Array.from(allMonths)
    .sort()
    .map((month) => ({ month, completed: completedMap.get(month) ?? 0, rejected: rejectedMap.get(month) ?? 0 }));
};

/** Monthly moderation actions for the last N months, oldest → newest. */
export const getMonthlyModeration = async (months: number): Promise<MonthlyModerationBucket[]> => {
  const db = getDb();
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const monthLabel = sql<string>`to_char(date_trunc('month', ${warnings.createdAt}), 'YYYY-MM')`;

  const warnRows = await db
    .select({ month: monthLabel, c: count() })
    .from(warnings)
    .where(gte(warnings.createdAt, since))
    .groupBy(sql`date_trunc('month', ${warnings.createdAt})`)
    .orderBy(sql`date_trunc('month', ${warnings.createdAt})`);

  const banLabel = sql<string>`to_char(date_trunc('month', ${bans.createdAt}), 'YYYY-MM')`;
  const banRows = await db
    .select({ month: banLabel, c: count() })
    .from(bans)
    .where(gte(bans.createdAt, since))
    .groupBy(sql`date_trunc('month', ${bans.createdAt})`)
    .orderBy(sql`date_trunc('month', ${bans.createdAt})`);

  const repLabel = sql<string>`to_char(date_trunc('month', ${reports.createdAt}), 'YYYY-MM')`;
  const repRows = await db
    .select({ month: repLabel, c: count() })
    .from(reports)
    .where(gte(reports.createdAt, since))
    .groupBy(sql`date_trunc('month', ${reports.createdAt})`)
    .orderBy(sql`date_trunc('month', ${reports.createdAt})`);

  const allMonths = new Set([...warnRows.map((r) => r.month), ...banRows.map((r) => r.month), ...repRows.map((r) => r.month)]);
  const warnMap = new Map(warnRows.map((r) => [r.month, Number(r.c)]));
  const banMap = new Map(banRows.map((r) => [r.month, Number(r.c)]));
  const repMap = new Map(repRows.map((r) => [r.month, Number(r.c)]));

  return Array.from(allMonths)
    .sort()
    .map((month) => ({ month, warnings: warnMap.get(month) ?? 0, bans: banMap.get(month) ?? 0, reports: repMap.get(month) ?? 0 }));
};

/** Daily bucket of joins over the last N days (oldest → newest). */
export const getDailyJoins = async (days: number): Promise<{ day: string; joins: number }[]> => {
  const db = getDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ day: sql<string>`to_char(date_trunc('day', ${auditLog.createdAt}), 'YYYY-MM-DD')`, joins: count() })
    .from(auditLog)
    .where(and(eq(auditLog.eventType, AuditEventType.MemberJoined), gte(auditLog.createdAt, since)))
    .groupBy(sql`date_trunc('day', ${auditLog.createdAt})`)
    .orderBy(sql`date_trunc('day', ${auditLog.createdAt})`);
  return rows.map((r) => ({ day: r.day, joins: Number(r.joins) }));
};
