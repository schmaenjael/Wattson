import { ApplicationCommandType, MessageFlags, PermissionFlagsBits } from 'discord.js';

import type { MiddlewareFunction } from '~/core/types';
import { getSettings } from '~/database';
import { ProcessExitCode } from '~/settings';

/**
 * Gate for administration-only commands. Passes if the member either has the
 * configured Administration role OR Discord's ManageGuild permission (fallback
 * for bootstrap, before roles have been configured).
 */
export const useAdmin: MiddlewareFunction<ApplicationCommandType.ChatInput> = async (command, client, interaction) => {
  if (!interaction.inGuild()) return { status: ProcessExitCode.NOPERM };

  const member = await interaction.guild?.members.fetch(interaction.user.id);
  if (!member) return { status: ProcessExitCode.NOPERM };

  const settings = await getSettings();
  const accessPermitted =
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    (settings.roleAdministrationId && member.roles.cache.has(settings.roleAdministrationId));

  if (accessPermitted) {
    return { status: ProcessExitCode.OK };
  }

  if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: 'This command is restricted to administrators.', flags: MessageFlags.Ephemeral });
  }
  return { status: ProcessExitCode.NOPERM };
};
