import { pgTable, serial, char, varchar, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';

import { Snowflake } from 'discord.js';
import { AppFeature } from '~/settings';

import { SNOWFLAKE_ID_LENGTH } from '~/settings';

type ValidPrefix = '!' | '#' | '$' | '%' | '&' | '+' | '-' | '.' | ':' | ';' | '<' | '=' | '?' | '@' | '\\' | '^' | '|' | '~';

type Channel = {
  /** @description channel id*/
  id: Snowflake;
};

type Feature = {
  /** @description if the feature is enabled */
  enabled: boolean;
};

type SurveillanceLogChannel = Channel & {
  /** @description the log actions */
  log: AppFeature[];
};

type System = {
  /** @description where bot should log the system messages */
  notificationChannelId?: Snowflake;
  /** @description if the bot should log the system messages */
  systemNotificationEnabled?: boolean;
};

type Verification = {
  /** @description if the bot should do the verification process automated via DMs */
  automatedVerification?: boolean;
  /** @description if the bot should check for blacklisted words in the users description, username */
  automatedAntagonistCheck?: boolean;
  /** @description if the bot should be strict about if an account has a verified email */
  requiresVerifiedEmail?: boolean;
  /** @description if a moderator needs to approve the join of a user at the end of the verification process */
  requiresApproval?: boolean;
  /** @description in which channel the bot should ask for user-join permission */
  approvalChannel?: Snowflake;
  /** @description in which channel the bot should log a user join */
  welcomeChannel?: Snowflake;
};
type Surveillance = {
  /** @description which channels the bot should ignore */
  excludedChannels?: Channel[];
  /** @description in which channels the surveillance and moderator actions should be logged */
  surveillanceLogChannels?: SurveillanceLogChannel[];
};

export interface AppConfig {
  /** @description the prefix the bot should listen too besides slash commands */
  prefix?: ValidPrefix;
  /** @description system relevant configuration */
  system: System & Feature;
  /** @description the surveillance config */
  surveillance: Surveillance & Feature;
  /** @description the verification and guild join config */
  verification: Verification & Feature;
}

export const tblGuild = pgTable('tblGuild', {
  id: serial('id').primaryKey(),
  guildId: char('guildId', { length: SNOWFLAKE_ID_LENGTH }).unique().notNull(),
  config: jsonb('config').notNull().$type<AppConfig>(),
  joinedAt: timestamp('joinedAt', { withTimezone: true }).notNull().defaultNow(),
});
