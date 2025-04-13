import { GatewayIntentBits, PresenceData, Snowflake } from 'discord.js';
import { TransportMultiOptions, TransportPipelineOptions, TransportSingleOptions } from 'pino';

import { UInt8 } from '~/utilities';
import { AppFeature, UserPermission } from '~/constants/system';

type Prefix = '!' | '#' | '$' | '%' | '&' | '+' | '-' | '.' | ':' | ';' | '<' | '=' | '?' | '@' | '\\' | '^' | '|' | '~';

export interface AppConfig {
  prefix?: Prefix;
  serverWhitelist: Snowflake[];
  appLog: AppConfigAppLog;
  intents: Array<GatewayIntentBits>;
  partials: boolean;
  presence: AppConfigPresence;
  permissionTree: AppConfigPermissionRole[];
  surveillance?: AppConfigSurveillance;
  verification?: AppConfigVerification;
}

interface AppConfigVerification {
  enabled: boolean;
}

interface AppConfigPermissionRole {
  name: UserPermission;
  id: Snowflake;
  //* Permissions are encoded in the following format
  // Unverified, Verified, Volter, Board Member, Chat Moderator, Discord Team Member, Developer, Administrator
  permissions: UInt8;
}

interface AppConfigSurveillance {
  enabled: boolean;
  excludedChannels: AppConfigChannel[];
  surveillanceChannels: (AppConfigChannel & { features: Array<AppFeature> })[];
}

interface AppConfigChannel {
  name: string;
  id: Snowflake;
}

interface AppConfigPresence extends PresenceData {}

interface AppConfigAppLog {
  [process.env.NODE_ENV]?: TransportSingleOptions | TransportMultiOptions | TransportPipelineOptions;
}
