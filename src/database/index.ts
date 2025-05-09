import { drizzle, NodePgClient, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

import { AppFeature, ProcessExitCode } from '~/settings';
import { Logger } from '~/utilities';

import { AppConfig, tblGuild } from './models';
import { Snowflake } from 'discord.js';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

class DatabaseClient {
  private static instance: (NodePgDatabase<any> & { $client: NodePgClient }) | null = null;
  private static configTable: Map<Snowflake, any> = new Map();

  private constructor() {}

  public static async loadConfig(guildId: Snowflake): Promise<AppConfig> {
    const logger = Logger.getInstance(AppFeature.Database);

    if (!DatabaseClient.instance) {
      logger.fatal('Database not initialized. Please call DatabaseClient.loadDatabase() first.');
      process.exit(ProcessExitCode.CONFIG);
    }

    if (!this.configTable.has(guildId)) {
      try {
        const { config } = await DatabaseClient.instance
          .select({ config: tblGuild.config })
          .from(tblGuild)
          .where(eq(tblGuild.guildId, guildId))
          .limit(1)
          .then((rows) => rows[0]);

        if (!config) {
          logger.fatal('No config found for this guild.');
          process.exit(ProcessExitCode.CONFIG);
        }

        logger.info('Successfully loaded config from tblGuild.');

        return config;
      } catch (error) {
        logger.fatal({ err: error }, 'Failed to load config from tblGuild. Exiting.');
        process.exit(ProcessExitCode.CONFIG);
      }
    }

    return this.configTable.get(guildId);
  }

  /**
   * Initializes the database connection.
   * @throws {Error} If the database is already connected.
   */
  public static async loadDatabase(): Promise<void> {
    if (DatabaseClient.instance) throw new Error('Database is already connected.');

    const logger = Logger.getInstance(AppFeature.Database);
    let retries = 0;

    const tryConnect = async (): Promise<void> => {
      try {
        const db = drizzle({
          connection: {
            database: process.env.POSTGRES_DB,
            user: process.env.BOT_USERNAME,
            password: process.env.BOT_PASSWORD,
            host: process.env.POSTGRES_HOST,
            port: Number(process.env.POSTGRES_PORT) ?? 5432,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 30000,
            max: 5,
          },
        });

        DatabaseClient.instance = db;

        logger.info('Successfully connected to Postgres via Drizzle.');
      } catch (error) {
        logger.error({ err: error }, `Postgres connection attempt ${++retries} failed.`);

        if (retries < MAX_RETRIES) {
          logger.warn(`Retrying to connect to Postgres in ${RETRY_DELAY_MS / 1000}s... (${retries}/${MAX_RETRIES})`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          return tryConnect();
        } else {
          logger.fatal('Max retries reached. Could not connect to Postgres. Exiting.');
          process.exit(ProcessExitCode.ERROR);
        }
      }
    };

    await tryConnect();
  }

  public static getInstance() {
    if (!DatabaseClient.instance) throw new Error('Database not initialized. Please call DatabaseClient.loadDatabase() first.');

    return DatabaseClient.instance;
  }
}

export * from './models';

export default DatabaseClient;
