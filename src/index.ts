/*
 *  __          __  _______ _______ _____  ____  _   _
 *  \ \        / /\|__   __|__   __/ ____|/ __ \| \ | |
 *   \ \  /\  / /  \  | |     | | | (___ | |  | |  \| |
 *    \ \/  \/ / /\ \ | |     | |  \___ \| |  | | . ` |
 *     \  /\  / ____ \| |     | |  ____) | |__| | |\  |
 *      \/  \/_/    \_|_|     |_| |_____/ \____/|_| \_|
 *  (c) schmaenjael
 */

import { loadEnvironment } from '~/core/loaders';
import { loadAllLocales } from '~/core/locales';
import { Client } from '~/core/models';
import { Logger, Utils } from '~/utilities';
import { ProcessExitCode } from './settings';
import DatabaseClient from '~/database';

const client = Client.getInstance();

/* Initialize Environment */
Promise.all([
  Utils.measurePerformance(loadEnvironment, 'loading environment variables')(),
  Utils.measurePerformance(loadAllLocales, 'loading localization (i18n)')(),
  Utils.measurePerformance(DatabaseClient.loadDatabase, 'initializing database connection')(),
])
  .then(() => client.start())
  .catch((error: Error) => {
    Logger.getInstance().fatal(Object(error), `Failed to start the server, due to ${error.name} unexpectedly being thrown: ${error.cause}`);
    process.exit(ProcessExitCode.ERROR);
  });
