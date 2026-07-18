import { Events } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature } from '~/settings';
import { enforceSingleGuild } from '~/core/providers/system';

export default new Event({ type: Events.GuildCreate, feature: AppFeature.System, middleware: [], handlers: [enforceSingleGuild] });
