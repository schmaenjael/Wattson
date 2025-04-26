import { Snowflake } from 'discord.js';

declare global {
  interface Environment {
    NODE_ENV: 'production' | 'development' | 'test';
    TOKEN: string;
    CLIENT_ID: Snowflake;
    APPLICATION_ID: Snowflake;
    MONGO_URI: string;
    MONGO_PASSWORD: string;
    MONGO_USERNAME: string;
    MONGO_INITDB_DATABASE: string;
  }

  interface Window {
    env: Environment;
  }

  namespace NodeJS {
    interface ProcessEnv extends Environment {}
  }
}

export {};
