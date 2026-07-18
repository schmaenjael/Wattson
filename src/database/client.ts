import { drizzle, NodePgClient, NodePgDatabase } from 'drizzle-orm/node-postgres';

import { getConfig } from '~/config';
import { AppFeature, ProcessExitCode } from '~/settings';
import { Logger } from '~/utilities';

import * as schema from './schema';

const POSTGRES_DEFAULT_PORT = 5432;

export type Database = NodePgDatabase<typeof schema> & { $client: NodePgClient };

let instance: Database | null = null;

export const getDb = (): Database => {
  if (!instance) throw new Error('Database not initialized. Call connectDatabase() first.');
  return instance;
};

export interface PoolStats {
  total: number;
  idle: number;
  waiting: number;
}

export const getPoolStats = (): PoolStats => {
  if (!instance) {
    return { total: 0, idle: 0, waiting: 0 };
  }

  const client = instance.$client;

  // $client is a NodePgClient union (Pool | PoolClient); only Pool exposes count fields.
  if ('totalCount' in client) {
    return { total: client.totalCount, idle: client.idleCount, waiting: client.waitingCount };
  }

  return { total: 0, idle: 0, waiting: 0 };
};

export const connectDatabase = async (): Promise<void> => {
  if (instance) throw new Error('Database is already connected.');

  // POOL_MAX: message pipeline runs an async queue at concurrency 500; steady-state is 0-query
  // (cached), but automod/antispam bursts (3-5 queries each) can starve a small pool.
  const { POOL_MAX, DB_MAX_RETRIES, DB_RETRY_DELAY_MS } = getConfig().env;

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
          max: POOL_MAX,
        },
      });

      logger.info('Connected to Postgres via Drizzle.');
    } catch (error) {
      attempts += 1;
      logger.error({ err: error }, `Postgres connection attempt ${attempts} failed.`);

      if (attempts < DB_MAX_RETRIES) {
        logger.warn(`Retrying Postgres connection in ${DB_RETRY_DELAY_MS / 1000}s (${attempts}/${DB_MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, DB_RETRY_DELAY_MS));
        return tryConnect();
      }

      logger.fatal('Max retries reached. Exiting.');
      process.exit(ProcessExitCode.UNAVAILABLE);
    }
  };

  await tryConnect();
};
