/*
 *  __          __  _______ _______ _____  ____  _   _
 *  \ \        / /\|__   __|__   __/ ____|/ __ \| \ | |
 *   \ \  /\  / /  \  | |     | | | (___ | |  | |  \| |
 *    \ \/  \/ / /\ \ | |     | |  \___ \| |  | | . ` |
 *     \  /\  / ____ \| |     | |  ____) | |__| | |\  |
 *      \/  \/_/    \_|_|     |_| |_____/ \____/|_| \_|
 *  (c) schmaenjael
 */

import { BotException, Client } from '~/core/models';
import { Logger, measurePerformance } from '~/utilities';
import { ProcessExitCode } from '~/settings';
import { loadConfig } from '~/config';
import { loadAllLocales } from '~/core/locales';
import { connectDatabase, getDb } from '~/database';
import { flushAnalytics } from '~/core/providers/analytics';
import { startHealthServer, stopHealthServer } from '~/core/providers/health';
import { setMaxListeners } from 'node:events';

const client = Client.getInstance();

setMaxListeners(256);

/** Best-effort Discord notification reusing BotException's logging path; never throws inside a global handler. */
const notifyDiscord = (message: string, cause: unknown): void => {
  try {
    if (!client.isReady()) return;
    new BotException(client, message, cause);
  } catch {
    /* swallow: notifying Discord must never crash an error handler */
  }
};

const shutdown = async (reason: string, exitCode: ProcessExitCode = ProcessExitCode.OK): Promise<void> => {
  const logger = Logger.getInstance();
  logger.info(`Received ${reason}, flushing buffered analytics and releasing resources before exit.`);

  await flushAnalytics().catch((error: Error) => logger.error(Object(error), 'Analytics flush on shutdown failed.'));

  try {
    await stopHealthServer();
  } catch (error) {
    logger.error(Object(error), 'Closing the health check server on shutdown failed.');
  }

  try {
    const dbClient = getDb().$client;
    if ('end' in dbClient) await dbClient.end();
  } catch (error) {
    logger.error(Object(error), 'Closing the database pool on shutdown failed.');
  }

  try {
    await client.destroy();
  } catch (error) {
    logger.error(Object(error), 'Destroying the Discord client on shutdown failed.');
  }

  process.exit(exitCode);
};

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

process.on('uncaughtException', (error: Error) => {
  Logger.getInstance().fatal(Object(error), `Uncaught exception: ${error.message}`);
  notifyDiscord('Uncaught exception encountered; shutting down.', error);
  void shutdown('uncaughtException', ProcessExitCode.ERROR);
});

process.on('unhandledRejection', (reason: unknown) => {
  Logger.getInstance().error(Object(reason), 'Unhandled promise rejection.');
  notifyDiscord('Unhandled promise rejection encountered.', reason);
});

loadConfig();

Promise.all([
  measurePerformance(loadAllLocales, 'loading localization (i18n)')(),
  measurePerformance(connectDatabase, 'initializing database connection')(),
])
  .then(() => client.start())
  .then(() => startHealthServer(client))
  .catch((error: Error) => {
    Logger.getInstance().fatal(Object(error), `Failed to start the server, due to ${error.name} unexpectedly being thrown: ${error.cause}`);
    process.exit(ProcessExitCode.ERROR);
  });
