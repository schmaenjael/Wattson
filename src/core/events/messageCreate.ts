import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { recordMessageActivity } from '~/core/providers/analytics';
import { onMessageCreate } from '~/core/providers/messagePipeline';

export default new Event({
  type: Events.MessageCreate,
  feature: AppFeature.Surveillance,
  middleware: [],
  handlers: [recordMessageActivity, onMessageCreate],
});
