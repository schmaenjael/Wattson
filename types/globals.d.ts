import { Snowflake } from 'discord.js';

declare global {
  interface Environment {
    NODE_ENV: 'production' | 'development' | 'test';
    TOKEN: string;
    CLIENT_ID: Snowflake;
    APPLICATION_ID: Snowflake;
    GUILD_ID: Snowflake;
    ADMIN_USER_ID: Snowflake;

    POSTGRES_DB: string;
    POSTGRES_HOST: string;
    POSTGRES_PORT?: string;
    BOT_USERNAME: string;
    BOT_PASSWORD: string;

    HATE_SPEECH_DETECTOR_ENDPOINT?: string;

    OLLAMA_ENDPOINT?: string;
    OLLAMA_MODEL?: string;

    BSKY_SERVICE?: string;
    BSKY_IDENTIFIER?: string;
    BSKY_APP_PASSWORD?: string;

    INSTAGRAM_ACCESS_TOKEN?: string;
    INSTAGRAM_BUSINESS_ACCOUNT_ID?: string;

    HAIILO_BASE_URL?: string;
    HAIILO_API_KEY?: string;

    BLOCKLIST_PATHS?: string;
  }

  interface Window {
    env: Environment;
  }

  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ProcessEnv extends Environment {}
  }
}

export {};
