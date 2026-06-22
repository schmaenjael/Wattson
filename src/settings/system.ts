import type { HexColorString } from 'discord.js';

import { Colors } from './theme';

export const LOADABLE_FILETYPES: Readonly<string[]> = ['.ts'];

/**
 @see Common Unix Error Codes https://tldp.org/LDP/abs/html/index.html
*/
export enum ProcessExitCode {
  OK = 0 /* successful termination */,
  ERROR = 1 /* general error with termination */,
  UNAVAILABLE = 69 /* service unavailable */,
  SOFTWARE = 70 /* internal software error */,
  IOERR = 74 /* input/output error */,
  TEMPFAIL = 75 /* temp failure; user is invited to retry */,
  WRONG_CONTEXT = 76 /* interaction issued in wrong context (DM vs guild) */,
  NOPERM = 77 /* permission denied */,
  CONFIG = 78 /* configuration error */,
}

enum AbilityCategories {
  Utility = 'Utility',
  Surveillance = 'Surveillance',
  Moderation = 'Moderation',
}

enum SystemCategories {
  System = 'System',
  Database = 'Database',
}

export type Categories = SystemCategories | AbilityCategories;

export enum AppFeature {
  Welcome = 'Welcome',
  Ping = 'Ping',
  Stats = 'Stats',
  Report = 'Report',
  Warn = 'Warn',
  Ban = 'Ban',
  AutomatedWarn = 'AutomatedWarn',
  AutomatedBan = 'AutomatedBan',
  Surveillance = 'MessageLogging',
  Kill = 'Kill',
  Restart = 'Restart',
  System = 'System',
  Database = 'Database',
  Rules = 'Rules',
  GdprDeletion = 'GdprDeletion',
  LinkFilter = 'LinkFilter',
  Profanity = 'Profanity',
  Sticky = 'Sticky',
  Modmail = 'Modmail',
  React = 'React',
  Clear = 'Clear',
  Ask = 'Ask',
  Say = 'Say',
  Lockdown = 'Lockdown',
  Mute = 'Mute',
  AntiSpam = 'AntiSpam',
  AntiHoist = 'AntiHoist',
  InviteTracking = 'InviteTracking',
  Appeal = 'Appeal',
  UserRecord = 'UserRecord',
  Events = 'Events',
  ForumRoles = 'ForumRoles',
  VolterVerification = 'VolterVerification',
  VerificationSweeper = 'VerificationSweeper',
  Scheduler = 'Scheduler',
  Suggestions = 'Suggestions',
  Analytics = 'Analytics',
}

export enum LogNamespace {
  Setup = '[SETUP]',
  Bot = '[BOT]',
  Command = '[CMD]',
  Moderation = '[MOD]',
  Surveillance = '[SURV]',
  Utility = '[UTIL]',
  System = '[SYS]',
  Database = '[DB]',
}

export const appFeatureMap: { [K in AppFeature]: { category: Categories; namespace: LogNamespace; color: HexColorString } } = {
  [AppFeature.Ping]: { category: AbilityCategories.Utility, namespace: LogNamespace.Utility, color: Colors.Orange },
  [AppFeature.Stats]: { category: AbilityCategories.Utility, namespace: LogNamespace.Utility, color: Colors.White },
  [AppFeature.Rules]: { category: AbilityCategories.Utility, namespace: LogNamespace.Utility, color: Colors.Purple },
  [AppFeature.Report]: { category: AbilityCategories.Surveillance, namespace: LogNamespace.Surveillance, color: Colors.White },
  [AppFeature.Warn]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.White },
  [AppFeature.Ban]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.White },
  [AppFeature.AutomatedWarn]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.White },
  [AppFeature.AutomatedBan]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.White },
  [AppFeature.Surveillance]: { category: AbilityCategories.Surveillance, namespace: LogNamespace.Surveillance, color: Colors.White },
  [AppFeature.Kill]: { category: SystemCategories.System, namespace: LogNamespace.System, color: Colors.White },
  [AppFeature.Restart]: { category: SystemCategories.System, namespace: LogNamespace.System, color: Colors.White },
  [AppFeature.System]: { category: SystemCategories.System, namespace: LogNamespace.System, color: Colors.Yellow },
  [AppFeature.Database]: { category: SystemCategories.Database, namespace: LogNamespace.Database, color: Colors.Yellow },
  [AppFeature.Welcome]: { category: AbilityCategories.Utility, namespace: LogNamespace.Utility, color: Colors.Purple },
  [AppFeature.GdprDeletion]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Red },
  [AppFeature.LinkFilter]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Red },
  [AppFeature.Profanity]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Red },
  [AppFeature.Sticky]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Blue },
  [AppFeature.Modmail]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Purple },
  [AppFeature.React]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Yellow },
  [AppFeature.Clear]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Red },
  [AppFeature.Ask]: { category: AbilityCategories.Utility, namespace: LogNamespace.Utility, color: Colors.Blue },
  [AppFeature.Say]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Purple },
  [AppFeature.Lockdown]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Red },
  [AppFeature.Mute]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Red },
  [AppFeature.AntiSpam]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Red },
  [AppFeature.AntiHoist]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Red },
  [AppFeature.InviteTracking]: { category: AbilityCategories.Surveillance, namespace: LogNamespace.Surveillance, color: Colors.Blue },
  [AppFeature.Appeal]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Blue },
  [AppFeature.UserRecord]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.Purple },
  [AppFeature.Events]: { category: AbilityCategories.Utility, namespace: LogNamespace.Utility, color: Colors.Blue },
  [AppFeature.ForumRoles]: { category: AbilityCategories.Utility, namespace: LogNamespace.Utility, color: Colors.Blue },
  [AppFeature.VolterVerification]: { category: AbilityCategories.Utility, namespace: LogNamespace.Utility, color: Colors.Purple },
  [AppFeature.VerificationSweeper]: { category: AbilityCategories.Surveillance, namespace: LogNamespace.Surveillance, color: Colors.Purple },
  [AppFeature.Scheduler]: { category: SystemCategories.System, namespace: LogNamespace.System, color: Colors.Yellow },
  [AppFeature.Suggestions]: { category: AbilityCategories.Utility, namespace: LogNamespace.Utility, color: Colors.Green },
  [AppFeature.Analytics]: { category: AbilityCategories.Surveillance, namespace: LogNamespace.Surveillance, color: Colors.Blue },
} as const;

export const MOD_LIST_PAGE_SIZE = 10;
