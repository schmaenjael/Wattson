import { Snowflake } from 'discord.js';

declare global {
  interface Environment {
    NODE_ENV: 'production' | 'development' | 'test';
    TOKEN: string;
    CLIENT_ID: Snowflake;
    APPLICATION_ID: Snowflake;
    ENV: 'docker' | undefined;
  }

  interface Window {
    env: Environment;
  }

  namespace NodeJS {
    interface ProcessEnv extends Environment {}
  }
}

export {};
