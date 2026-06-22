import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { trackMemberJoin } from '~/core/providers/inviteTracking';
import { welcomeMember } from '~/core/providers/welcome';

export default new Event({
  type: Events.GuildMemberAdd,
  feature: AppFeature.System,
  middleware: [],
  handlers: [trackMemberJoin, welcomeMember],
});
