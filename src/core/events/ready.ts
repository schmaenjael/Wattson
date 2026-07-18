import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { bootstrap } from '~/core/providers/system';

export default new Event({ type: Events.ClientReady, feature: AppFeature.System, once: true, middleware: [], handlers: [bootstrap] });
