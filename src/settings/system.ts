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
}

export type Categories = SystemCategories | AbilityCategories;

export enum AppFeature {
  Ping = 'Ping',
  Stats = 'Stats',
  Report = 'Report',
  Warn = 'Warn',
  Ban = 'Ban',
  AutomatedWarn = 'AutomatedWarn',
  AutomatedBan = 'AutomatedBan',
  MessageLogging = 'MessageLogging',
  Kill = 'Kill',
  Restart = 'Restart',
  System = 'System',
}

export enum LogNamespace {
  Setup = '[SETUP]',
  Bot = '[BOT]',
  Command = '[CMD]',
  Moderation = '[MOD]',
  Surveillance = '[SURV]',
  Utility = '[UTIL]',
  System = '[SYS]',
}

export const appFeatureMap: { [K in AppFeature]: { category: Categories; namespace: LogNamespace; color: HexColorString } } = {
  [AppFeature.Ping]: { category: AbilityCategories.Utility, namespace: LogNamespace.Utility, color: Colors.White },
  [AppFeature.Stats]: { category: AbilityCategories.Utility, namespace: LogNamespace.Utility, color: Colors.White },
  [AppFeature.Report]: { category: AbilityCategories.Surveillance, namespace: LogNamespace.Surveillance, color: Colors.White },
  [AppFeature.Warn]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.White },
  [AppFeature.Ban]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.White },
  [AppFeature.AutomatedWarn]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.White },
  [AppFeature.AutomatedBan]: { category: AbilityCategories.Moderation, namespace: LogNamespace.Moderation, color: Colors.White },
  [AppFeature.MessageLogging]: { category: AbilityCategories.Surveillance, namespace: LogNamespace.Surveillance, color: Colors.White },
  [AppFeature.Kill]: { category: SystemCategories.System, namespace: LogNamespace.System, color: Colors.White },
  [AppFeature.Restart]: { category: SystemCategories.System, namespace: LogNamespace.System, color: Colors.White },
  [AppFeature.System]: { category: SystemCategories.System, namespace: LogNamespace.System, color: Colors.White },
} as const;
