import { Events, Interaction, MessageFlags } from 'discord.js';

import { Client } from '~/core/models';
import type { MiddlewareFunction } from '~/core/types';
import { getSettings } from '~/database';
import { L } from '~/core/locales';
import { ProcessExitCode } from '~/settings';
import { memberHasAllPermissions } from '~/core/middleware/permissionCore';

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
 * src/core/events/interactionCreate.ts so it fires once per interaction.
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

  if (!memberHasAllPermissions(member, settings, required)) {
    await replyNoPerm(interaction);
    return { status: ProcessExitCode.NOPERM };
  }

  return { status: ProcessExitCode.OK };
};
