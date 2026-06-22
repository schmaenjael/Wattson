import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { recordMemberRemoval } from '~/core/providers/surveillance/memberRemove';

export default new Event({
  type: Events.GuildMemberRemove,
  feature: AppFeature.Surveillance,
  middleware: [],
  handlers: [recordMemberRemoval],
});
