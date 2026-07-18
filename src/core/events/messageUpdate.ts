import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { runAutomodOnEdit } from '~/core/providers/automod';
import { reportMessageEdit } from '~/core/providers/surveillance';

export default new Event({
  type: Events.MessageUpdate,
  feature: AppFeature.Surveillance,
  middleware: [],
  handlers: [reportMessageEdit, runAutomodOnEdit],
});
