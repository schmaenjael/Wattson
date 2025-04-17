import { TransportMultiOptions, TransportPipelineOptions, TransportSingleOptions } from 'pino';
import { GatewayIntentBits, PresenceData, Snowflake } from 'discord.js';

import { UserRole } from '~/models';
import { AppFeature } from '~/constants';

type Verification = { enabled: boolean };
type Channel = { name: string; id: Snowflake };
type AppLog = { [process.env.NODE_ENV]?: TransportSingleOptions | TransportMultiOptions | TransportPipelineOptions };
type ValidPrefix = '!' | '#' | '$' | '%' | '&' | '+' | '-' | '.' | ':' | ';' | '<' | '=' | '?' | '@' | '\\' | '^' | '|' | '~';
type Surveillance = {
  enabled: boolean;
  excludedChannels: Channel[];
  surveillanceChannels: (Channel & { features: Array<AppFeature> })[];
};

export interface AppConfig {
  prefix?: ValidPrefix;
  serverWhitelist: Snowflake[];
  appLog: AppLog;
  intents: Array<GatewayIntentBits>;
  partials: boolean;
  presence: PresenceData;
  permissionTree: UserRole[];
  surveillance?: Surveillance;
  verification?: Verification;
}
