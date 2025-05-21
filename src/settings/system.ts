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
} as const;

export const SNOWFLAKE_ID_LENGTH = 20;
export const MAX_PREFIX_LENGTH = 1;
export const USERNAME_LENGTH = 32;
export const MAX_COMMENT_LENGTH = 512;
