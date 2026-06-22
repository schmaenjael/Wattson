/*
 *  __          __  _______ _______ _____  ____  _   _
 *  \ \        / /\|__   __|__   __/ ____|/ __ \| \ | |
 *   \ \  /\  / /  \  | |     | | | (___ | |  | |  \| |
 *    \ \/  \/ / /\ \ | |     | |  \___ \| |  | | . ` |
 *     \  /\  / ____ \| |     | |  ____) | |__| | |\  |
 *      \/  \/_/    \_|_|     |_| |_____/ \____/|_| \_|
 *  (c) schmaenjael
 */

import { Client } from '~/core/models';
import { Logger, measurePerformance } from '~/utilities';
import { ProcessExitCode } from '~/settings';
import { loadAllLocales } from '~/core/locales';
import { loadEnvironment } from '~/core/loaders';
import { connectDatabase, ensureSettingsSeeded } from '~/database';
import { flushAnalytics } from '~/core/providers/analytics';
import { setMaxListeners } from 'node:events';

const client = Client.getInstance();

setMaxListeners(256);

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  Logger.getInstance().info(`Received ${signal}, flushing buffered analytics before exit.`);
  await flushAnalytics().catch((error: Error) => Logger.getInstance().error(Object(error), 'Analytics flush on shutdown failed.'));
  process.exit(ProcessExitCode.OK);
};

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

Promise.all([
  measurePerformance(loadEnvironment, 'loading environment variables')(),
  measurePerformance(loadAllLocales, 'loading localization (i18n)')(),
  measurePerformance(connectDatabase, 'initializing database connection')(),
])
  .then(() => ensureSettingsSeeded())
  .then(() => client.start())
  .catch((error: Error) => {
    Logger.getInstance().fatal(Object(error), `Failed to start the server, due to ${error.name} unexpectedly being thrown: ${error.cause}`);
    process.exit(ProcessExitCode.ERROR);
  });
