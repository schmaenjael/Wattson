import { Snowflake } from 'discord.js';

export interface Environment {
  NODE_ENV: 'production' | 'development' | 'test';
  TOKEN: string;
  CLIENT_ID: Snowflake;
  APPLICATION_ID: Snowflake;
}

declare global {
  interface Window {
    env: Environment;
  }

  namespace NodeJS {
    interface ProcessEnv extends Environment {}
  }
}
