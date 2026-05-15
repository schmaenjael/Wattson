import { drizzle, NodePgClient, NodePgDatabase } from 'drizzle-orm/node-postgres';

import { AppFeature, ProcessExitCode } from '~/settings';
import { Logger } from '~/utilities';

import * as schema from './schema';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5_000;
const POSTGRES_DEFAULT_PORT = 5432;

export type Database = NodePgDatabase<typeof schema> & { $client: NodePgClient };

let instance: Database | null = null;

export const getDb = (): Database => {
  if (!instance) throw new Error('Database not initialized. Call connectDatabase() first.');
  return instance;
};

export const connectDatabase = async (): Promise<void> => {
  if (instance) throw new Error('Database is already connected.');

  const logger = Logger.getInstance(AppFeature.Database);
  let attempts = 0;

  const tryConnect = async (): Promise<void> => {
    try {
      instance = drizzle({
        schema,
        casing: 'snake_case',
        connection: {
          host: process.env.POSTGRES_HOST,
          port: Number(process.env.POSTGRES_PORT ?? POSTGRES_DEFAULT_PORT),
          database: process.env.POSTGRES_DB,
          user: process.env.BOT_USERNAME,
          password: process.env.BOT_PASSWORD,
          connectionTimeoutMillis: 10_000,
          idleTimeoutMillis: 30_000,
          max: 5,
        },
      });

      logger.info('Connected to Postgres via Drizzle.');
    } catch (error) {
      attempts += 1;
      logger.error({ err: error }, `Postgres connection attempt ${attempts} failed.`);

      if (attempts < MAX_RETRIES) {
        logger.warn(`Retrying Postgres connection in ${RETRY_DELAY_MS / 1000}s (${attempts}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return tryConnect();
      }

      logger.fatal('Max retries reached. Exiting.');
      process.exit(ProcessExitCode.UNAVAILABLE);
    }
  };

  await tryConnect();
};
