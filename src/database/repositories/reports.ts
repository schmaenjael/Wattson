import { count, desc, eq, or, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { reports } from '~/database/schema/reports';
import { ReportStatus } from '~/database/schema/enums';

export type Report = InferSelectModel<typeof reports>;
export type NewReport = Omit<
  InferInsertModel<typeof reports>,
  'id' | 'status' | 'createdAt' | 'resolvedAt' | 'resolvedBy' | 'logMessageId' | 'todoMessageId'
>;
export type ReportMessageIds = Pick<Report, 'logMessageId' | 'todoMessageId'>;

export const insertReport = async (input: NewReport): Promise<Report> => {
  const db = getDb();
  const [row] = await db.insert(reports).values(input).returning();
  return row;
};

export const setReportMessageIds = async (id: number, ids: ReportMessageIds): Promise<void> => {
  const db = getDb();
  await db.update(reports).set(ids).where(eq(reports.id, id));
};

export const listOpenReports = async (): Promise<Report[]> => {
  const db = getDb();
  return db.select().from(reports).where(eq(reports.status, ReportStatus.Open)).orderBy(desc(reports.createdAt));
};

export const listReports = async (status?: ReportStatus): Promise<Report[]> => {
  const db = getDb();
  const base = db.select().from(reports).orderBy(desc(reports.createdAt));
  return status ? base.where(eq(reports.status, status)) : base;
};

export const findReportById = async (id: number): Promise<Report | undefined> => {
  const db = getDb();
  const [row] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return row;
};

export const resolveReport = async (id: number, resolvedBy: string, status: ReportStatus): Promise<Report | undefined> => {
  const db = getDb();
  const [row] = await db.update(reports).set({ status, resolvedBy, resolvedAt: new Date() }).where(eq(reports.id, id)).returning();
  return row;
};

export const listReportsAgainstUser = async (userId: string): Promise<Report[]> => {
  const db = getDb();
  return db.select().from(reports).where(eq(reports.reportedUserId, userId)).orderBy(desc(reports.createdAt));
};

export const listReportsFiledByUser = async (userId: string): Promise<Report[]> => {
  const db = getDb();
  return db.select().from(reports).where(eq(reports.reporterId, userId)).orderBy(desc(reports.createdAt));
};

export const countReportsForUser = async (reportedUserId: string): Promise<number> => {
  const db = getDb();
  const [{ c }] = await db.select({ c: count() }).from(reports).where(eq(reports.reportedUserId, reportedUserId));
  return Number(c);
};

export const deleteReportsForUser = async (userId: string): Promise<number> => {
  const db = getDb();
  const result = await db
    .delete(reports)
    .where(or(eq(reports.reporterId, userId), eq(reports.reportedUserId, userId)))
    .returning();
  return result.length;
};
