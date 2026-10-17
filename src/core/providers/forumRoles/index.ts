import { GuildMember, PartialGuildMember } from 'discord.js';

import { AppFeature } from '~/settings';
import { Client } from '~/core/models';
import { softFail } from '~/utilities';
import { getForumRoleMappingsByRole } from '~/config';
import { getConfig } from '~/config';

/** Adds a member to the forum threads mapped to any role they just gained. */
export const syncForumRoles = async (_client: Client, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> => {
  if (!getConfig().config.features.forumRoles) return;

  const oldRoleIds = new Set(oldMember.roles.cache.keys());
  const added = [...newMember.roles.cache.keys()].filter((id) => !oldRoleIds.has(id));

  if (added.length === 0) return;

  for (const roleId of added) {
    const mappings = await getForumRoleMappingsByRole(roleId);
    for (const mapping of mappings) {
      const channel = await newMember.guild.channels
        .fetch(mapping.channelId)
        .catch(softFail(AppFeature.ForumRoles, 'FORUMROLES_CHANNEL_FETCH', { channelId: mapping.channelId }));
      if (!channel?.isThread()) continue;
      await channel.members
        .add(newMember.id)
        .catch(softFail(AppFeature.ForumRoles, 'FORUMROLES_THREAD_MEMBER_ADD', { userId: newMember.id, channelId: mapping.channelId }));
    }
  }
};
