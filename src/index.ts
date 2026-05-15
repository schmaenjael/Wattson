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

const client = Client.getInstance();

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
