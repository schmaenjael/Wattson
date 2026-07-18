import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Event, onMessageCreate } from '~/core/models';
import { recordMessageActivity } from '~/core/providers/analytics';

export default new Event({
  type: Events.MessageCreate,
  feature: AppFeature.Surveillance,
  middleware: [],
  handlers: [recordMessageActivity, onMessageCreate],
});
