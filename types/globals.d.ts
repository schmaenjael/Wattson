import { Snowflake } from 'discord.js';

declare global {
  interface Environment {
    NODE_ENV: 'production' | 'development' | 'test';
    TOKEN: string;
    CLIENT_ID: Snowflake;
    APPLICATION_ID: Snowflake;
    POSTGRES_USER: string;
    POSTGRES_PASSWORD: string;
    POSTGRES_DB: string;
    BOT_USERNAME: string;
    BOT_PASSWORD: string;
    POSTGRES_HOST: string;
  }

  interface Window {
    env: Environment;
  }

  namespace NodeJS {
    interface ProcessEnv extends Environment {}
  }
}

export {};
