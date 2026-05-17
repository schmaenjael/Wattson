import { relations } from 'drizzle-orm';

import { users } from './users';
import { usernameHistory } from './usernameHistory';
import { warnings } from './warnings';
import { bans } from './bans';
import { reports } from './reports';
import { courtCases } from './courtCases';
import { externalPosts } from './externalPosts';
import { starboardEntries } from './starboardEntries';
import { events } from './events';
import { eventRegistrations } from './eventRegistrations';

export const usersRelations = relations(users, ({ many }) => ({
  usernameHistory: many(usernameHistory),
  warningsReceived: many(warnings, { relationName: 'warning_target' }),
  warningsIssued: many(warnings, { relationName: 'warning_moderator' }),
  bansReceived: many(bans, { relationName: 'ban_target' }),
  bansIssued: many(bans, { relationName: 'ban_moderator' }),
  reportsFiled: many(reports, { relationName: 'report_reporter' }),
  reportsAgainst: many(reports, { relationName: 'report_target' }),
  courtCasesAgainst: many(courtCases, { relationName: 'court_accused' }),
  courtCasesOpened: many(courtCases, { relationName: 'court_moderator' }),
}));

export const usernameHistoryRelations = relations(usernameHistory, ({ one }) => ({
  user: one(users, { fields: [usernameHistory.userId], references: [users.id] }),
}));

export const warningsRelations = relations(warnings, ({ one }) => ({
  target: one(users, { fields: [warnings.targetUserId], references: [users.id], relationName: 'warning_target' }),
  moderator: one(users, { fields: [warnings.moderatorId], references: [users.id], relationName: 'warning_moderator' }),
  revoker: one(users, { fields: [warnings.revokedBy], references: [users.id] }),
}));

export const bansRelations = relations(bans, ({ one }) => ({
  target: one(users, { fields: [bans.targetUserId], references: [users.id], relationName: 'ban_target' }),
  moderator: one(users, { fields: [bans.moderatorId], references: [users.id], relationName: 'ban_moderator' }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id], relationName: 'report_reporter' }),
  reportedUser: one(users, { fields: [reports.reportedUserId], references: [users.id], relationName: 'report_target' }),
  resolver: one(users, { fields: [reports.resolvedBy], references: [users.id] }),
}));

export const courtCasesRelations = relations(courtCases, ({ one }) => ({
  accused: one(users, { fields: [courtCases.accusedUserId], references: [users.id], relationName: 'court_accused' }),
  openedBy: one(users, { fields: [courtCases.openedByModeratorId], references: [users.id], relationName: 'court_moderator' }),
  closer: one(users, { fields: [courtCases.closedBy], references: [users.id] }),
}));

export const externalPostsRelations = relations(externalPosts, ({ one }) => ({
  source: one(starboardEntries, { fields: [externalPosts.sourceMessageId], references: [starboardEntries.sourceMessageId] }),
}));

export const starboardEntriesRelations = relations(starboardEntries, ({ many }) => ({ externalPosts: many(externalPosts) }));

export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(users, { fields: [events.creatorId], references: [users.id] }),
  parent: one(events, { fields: [events.parentEventId], references: [events.id], relationName: 'event_children' }),
  children: many(events, { relationName: 'event_children' }),
  registrations: many(eventRegistrations),
}));

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
  event: one(events, { fields: [eventRegistrations.eventId], references: [events.id] }),
  user: one(users, { fields: [eventRegistrations.userId], references: [users.id] }),
}));
