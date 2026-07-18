import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { reportMessageDelete } from '~/core/providers/surveillance';

export default new Event({ type: Events.MessageDelete, feature: AppFeature.Surveillance, middleware: [], handlers: [reportMessageDelete] });
