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
import { loadDatabase } from '~/database';
import { Client } from '~/core/models';

const client = Client.getInstance();

Promise.all([loadEnvironment(), loadAllLocales(), loadDatabase()]).then(() => client.start());
