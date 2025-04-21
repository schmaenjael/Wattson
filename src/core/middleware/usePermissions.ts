import { Events, GuildMember } from 'discord.js';

import type { MiddlewareFunction } from '~/core/types';

export const usePermissions: MiddlewareFunction<typeof Events.InteractionCreate> = async (event, client, interaction) => {
  const member = interaction.member as GuildMember;

  const roleNames = member.roles.cache.map((role) => role.name);
  console.log(`User ${interaction.user.tag} has roles:`, roleNames);
};
