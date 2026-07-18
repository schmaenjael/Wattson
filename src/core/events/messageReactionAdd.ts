import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { handleReactionAdd } from '~/core/providers/starboard';
import { recordReactionActivity } from '~/core/providers/analytics';
import { sendStickyInfo } from '~/core/providers/sticky';

export default new Event({
  type: Events.MessageReactionAdd,
  feature: AppFeature.System,
  middleware: [],
  handlers: [handleReactionAdd, recordReactionActivity, sendStickyInfo],
});
