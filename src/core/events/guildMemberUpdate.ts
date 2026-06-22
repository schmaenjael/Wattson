import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { enforceNickname } from '~/core/providers/antihoist';
import { syncForumRoles } from '~/core/providers/forumRoles';
import { recordMemberUpdate } from '~/core/providers/surveillance/memberUpdate';

export default new Event({
  type: Events.GuildMemberUpdate,
  feature: AppFeature.System,
  middleware: [],
  // recordMemberUpdate first: it reads the as-delivered displayName before enforceNickname's setNickname mutates the cache.
  handlers: [recordMemberUpdate, syncForumRoles, enforceNickname],
});
