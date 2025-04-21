import { TransportMultiOptions, TransportPipelineOptions, TransportSingleOptions } from 'pino';
import { GatewayIntentBits, PresenceData, Snowflake } from 'discord.js';

import { UserRole } from '~/models';
import { AppFeature } from '~/settings';

type TransportOptions = TransportSingleOptions | TransportMultiOptions | TransportPipelineOptions;

type Verification = { enabled: boolean };
type Channel = { name: string; id: Snowflake };
type AppLog = { development?: TransportOptions; production?: TransportOptions; test?: TransportOptions };
type ValidPrefix = '!' | '#' | '$' | '%' | '&' | '+' | '-' | '.' | ':' | ';' | '<' | '=' | '?' | '@' | '\\' | '^' | '|' | '~';
type Surveillance = { enabled: boolean; excludedChannels: Channel[]; surveillanceChannels: (Channel & { features: Array<AppFeature> })[] };

declare global {
  interface AppConfig {
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
}

export {};
