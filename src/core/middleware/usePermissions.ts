import { Events, Interaction, MessageFlags, PermissionFlagsBits } from 'discord.js';

import { Client } from '~/core/models';
import type { MiddlewareFunction } from '~/core/types';
import { getSettings, Settings } from '~/database';
import { Permission } from '~/core/models';
import { L } from '~/core/locales';
import { ProcessExitCode } from '~/settings';

const ROLE_COLUMN_BY_PERMISSION: Record<Permission, keyof Settings> = {
  [Permission.Unregistered]: 'roleUnregisteredId',
  [Permission.Community]: 'roleCommunityId',
  [Permission.Member]: 'roleMemberId',
  [Permission.EventManager]: 'roleEventManagerId',
  [Permission.Moderation]: 'roleModerationId',
  [Permission.Administration]: 'roleAdministrationId',
};

const replyNoPerm = async (interaction: Interaction) => {
  if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: L[interaction.locale].GENERAL.COMMAND_INVALID_PERMISSIONS(), flags: MessageFlags.Ephemeral });
  }
};

const replyDmOnly = async (interaction: Interaction) => {
  if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: L[interaction.locale].GENERAL.COMMAND_DM_ONLY(), flags: MessageFlags.Ephemeral });
  }
};

const replyWrongContext = async (interaction: Interaction) => {
  if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: L[interaction.locale].GENERAL.COMMAND_INVALID_IN_DMS(), flags: MessageFlags.Ephemeral });
  }
};

/**
 * Runs on the central InteractionCreate event and enforces the dispatched
 * command's own `requiredPermissions`. Attached as middleware on
 * src/core/events/system/commands.ts so it fires once per interaction.
 */
export const usePermissions: MiddlewareFunction<typeof Events.InteractionCreate> = async (_event, client: Client, interaction: Interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return { status: ProcessExitCode.OK };

  if (interaction.user.id === process.env.ADMIN_USER_ID) return { status: ProcessExitCode.OK };

  const command = client.getCommands().get(interaction.commandName);
  const required = command?.options.requiredPermissions ?? [];

  if (!interaction.inGuild()) {
    if (command?.options.allowDM || command?.options.dmOnly) return { status: ProcessExitCode.OK };
    await replyWrongContext(interaction);
    return { status: ProcessExitCode.WRONG_CONTEXT };
  }

  if (command?.options.dmOnly) {
    await replyDmOnly(interaction);
    return { status: ProcessExitCode.WRONG_CONTEXT };
  }

  if (required.length === 0) return { status: ProcessExitCode.OK };

  const [member, settings] = await Promise.all([interaction.guild?.members.fetch(interaction.user.id), getSettings()]);
  if (!member) {
    await replyNoPerm(interaction);
    return { status: ProcessExitCode.NOPERM };
  }

  // Bootstrap fallback: allow ManageGuild only when the admin role hasn't been configured yet
  if (!settings.roleAdministrationId && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return { status: ProcessExitCode.OK };
  }

  const memberRoleIds = new Set(member.roles.cache.keys());

  const missing = required.filter((permission) => {
    const roleId = settings[ROLE_COLUMN_BY_PERMISSION[permission]] as string | null;
    return !roleId || !memberRoleIds.has(roleId);
  });

  if (missing.length > 0) {
    await replyNoPerm(interaction);
    return { status: ProcessExitCode.NOPERM };
  }

  return { status: ProcessExitCode.OK };
};
