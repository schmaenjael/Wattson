import { relations } from 'drizzle-orm';

import { users } from './users';
import { usernameHistory } from './usernameHistory';
import { warnings } from './warnings';
import { bans } from './bans';
import { appeals } from './appeals';
import { appealVotes } from './appealVotes';
import { reports } from './reports';
import { courtCases } from './courtCases';
import { courtVotes } from './courtVotes';
import { externalPosts } from './externalPosts';
import { starboardEntries } from './starboardEntries';
import { events } from './events';
import { eventRegistrations } from './eventRegistrations';
import { voltVerifications } from './voltVerifications';
import { suggestions } from './suggestions';
import { suggestionVotes } from './suggestionVotes';

export const usersRelations = relations(users, ({ many, one }) => ({
  usernameHistory: many(usernameHistory),
  warningsReceived: many(warnings, { relationName: 'warning_target' }),
  warningsIssued: many(warnings, { relationName: 'warning_moderator' }),
  bansReceived: many(bans, { relationName: 'ban_target' }),
  bansIssued: many(bans, { relationName: 'ban_moderator' }),
  reportsFiled: many(reports, { relationName: 'report_reporter' }),
  reportsAgainst: many(reports, { relationName: 'report_target' }),
  courtCasesAgainst: many(courtCases, { relationName: 'court_accused' }),
  courtCasesOpened: many(courtCases, { relationName: 'court_moderator' }),
  voltVerification: one(voltVerifications, { fields: [users.id], references: [voltVerifications.discordUserId] }),
}));

export const voltVerificationsRelations = relations(voltVerifications, ({ one }) => ({
  user: one(users, { fields: [voltVerifications.discordUserId], references: [users.id] }),
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
  appeal: one(appeals, { fields: [bans.id], references: [appeals.banId] }),
}));

export const appealsRelations = relations(appeals, ({ one, many }) => ({
  ban: one(bans, { fields: [appeals.banId], references: [bans.id] }),
  resolver: one(users, { fields: [appeals.resolvedBy], references: [users.id] }),
  votes: many(appealVotes),
}));

export const appealVotesRelations = relations(appealVotes, ({ one }) => ({
  appeal: one(appeals, { fields: [appealVotes.appealId], references: [appeals.id] }),
  voter: one(users, { fields: [appealVotes.voterId], references: [users.id] }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id], relationName: 'report_reporter' }),
  reportedUser: one(users, { fields: [reports.reportedUserId], references: [users.id], relationName: 'report_target' }),
  resolver: one(users, { fields: [reports.resolvedBy], references: [users.id] }),
}));

export const courtCasesRelations = relations(courtCases, ({ one, many }) => ({
  accused: one(users, { fields: [courtCases.accusedUserId], references: [users.id], relationName: 'court_accused' }),
  openedBy: one(users, { fields: [courtCases.openedByModeratorId], references: [users.id], relationName: 'court_moderator' }),
  closer: one(users, { fields: [courtCases.closedBy], references: [users.id] }),
  votes: many(courtVotes),
}));

export const courtVotesRelations = relations(courtVotes, ({ one }) => ({
  case: one(courtCases, { fields: [courtVotes.caseId], references: [courtCases.id] }),
  moderator: one(users, { fields: [courtVotes.moderatorId], references: [users.id] }),
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

export const suggestionsRelations = relations(suggestions, ({ one, many }) => ({
  author: one(users, { fields: [suggestions.userId], references: [users.id] }),
  votes: many(suggestionVotes),
}));

export const suggestionVotesRelations = relations(suggestionVotes, ({ one }) => ({
  suggestion: one(suggestions, { fields: [suggestionVotes.suggestionId], references: [suggestions.id] }),
  voter: one(users, { fields: [suggestionVotes.voterId], references: [users.id] }),
}));
