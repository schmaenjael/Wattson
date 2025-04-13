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

export enum UserPermission {
  Unverified,
  Verified,
  PartyMember,
  BoardMember,
  ChatModerator,
  TeamMember,
  Developer,
  Administrator,
}

export enum AbilityCategories {
  Utility = 'Utility',
  Surveillance = 'Surveillance',
  Moderation = 'Moderation',
}

export enum SystemCategories {
  System = 'System',
}

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
  Setup = ' [ SETUP ] ',
  Bot = ' [  BOT  ] ',
  Command = ' [  CMD  ] ',
  Moderation = ' [ MOD ] ',
  Surveillance = ' [ SURV ] ',
  Utility = ' [ UTIL ] ',
  System = ' [ SYS ] ',
}

export const appFeatureMap: {
  [K in AppFeature]: { category: AbilityCategories | SystemCategories; logNamespace: LogNamespace };
} = {
  [AppFeature.Ping]: { category: AbilityCategories.Utility, logNamespace: LogNamespace.Utility },
  [AppFeature.Stats]: { category: AbilityCategories.Utility, logNamespace: LogNamespace.Utility },
  [AppFeature.Report]: { category: AbilityCategories.Surveillance, logNamespace: LogNamespace.Surveillance },
  [AppFeature.Warn]: { category: AbilityCategories.Moderation, logNamespace: LogNamespace.Moderation },
  [AppFeature.Ban]: { category: AbilityCategories.Moderation, logNamespace: LogNamespace.Moderation },
  [AppFeature.AutomatedWarn]: { category: AbilityCategories.Moderation, logNamespace: LogNamespace.Moderation },
  [AppFeature.AutomatedBan]: { category: AbilityCategories.Moderation, logNamespace: LogNamespace.Moderation },
  [AppFeature.MessageLogging]: { category: AbilityCategories.Surveillance, logNamespace: LogNamespace.Surveillance },
  [AppFeature.Kill]: { category: SystemCategories.System, logNamespace: LogNamespace.System },
  [AppFeature.Restart]: { category: SystemCategories.System, logNamespace: LogNamespace.System },
  [AppFeature.System]: { category: SystemCategories.System, logNamespace: LogNamespace.System },
};
