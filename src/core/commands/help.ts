import { ApplicationCommandType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import { getSettings, type Settings } from '~/database';
import { softFail } from '~/utilities';

const PERMISSION_TIERS = [
  Permission.Unregistered,
  Permission.Community,
  Permission.Member,
  Permission.EventManager,
  Permission.Moderation,
  Permission.Administration,
] as const;

const ROLE_COLUMN: Record<Permission, keyof Settings> = {
  [Permission.Unregistered]: 'roleUnregisteredId',
  [Permission.Community]: 'roleCommunityId',
  [Permission.Member]: 'roleMemberId',
  [Permission.EventManager]: 'roleEventManagerId',
  [Permission.Moderation]: 'roleModerationId',
  [Permission.Administration]: 'roleAdministrationId',
};

const fmtCommands = (cmds: Command<ApplicationCommandType>[]): string =>
  cmds
    .map((c) => {
      const data = c.options.data as { name: string; description: string };
      return `**/${data.name}** — ${data.description}`;
    })
    .sort()
    .join('\n');

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.System,
  type: ApplicationCommandType.ChatInput,
  middleware: [],
  data: new SlashCommandBuilder().setName('help').setDescription('Show commands available at your permission level.'),

  async executeCommand(command, client, interaction) {
    const settings = await getSettings();
    const member = interaction.guild
      ? await interaction.guild.members
          .fetch(interaction.user.id)
          .catch(softFail(AppFeature.System, 'HELP_MEMBER_FETCH', { userId: interaction.user.id }))
      : null;

    const memberRoleIds = member ? new Set(member.roles.cache.keys()) : new Set<string>();
    const hasManageGuild = member?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;

    const userTiers = new Set<Permission>();
    for (const tier of PERMISSION_TIERS) {
      const roleId = settings[ROLE_COLUMN[tier]] as string | null;
      if (roleId && memberRoleIds.has(roleId)) {
        userTiers.add(tier);
      }
    }

    const isAdmin = hasManageGuild || interaction.user.id === process.env.ADMIN_USER_ID || userTiers.has(Permission.Administration);
    const isMod = isAdmin || userTiers.has(Permission.Moderation);
    const isMember = isMod || userTiers.has(Permission.Member);
    const isCommunity = isMember || userTiers.has(Permission.Community);

    const canAccess = (cmd: Command<ApplicationCommandType>): boolean => {
      const required = cmd.options.requiredPermissions ?? [];

      if (required.includes(Permission.Administration)) return isAdmin;
      if (required.includes(Permission.Moderation)) return isMod;
      if (required.includes(Permission.Member)) return isMember;
      if (required.includes(Permission.Community)) return isCommunity;
      return true;
    };

    const isAdminCmd = (cmd: Command<ApplicationCommandType>): boolean => (cmd.options.requiredPermissions ?? []).includes(Permission.Administration);

    const isModCmd = (cmd: Command<ApplicationCommandType>): boolean =>
      !isAdminCmd(cmd) && (cmd.options.requiredPermissions ?? []).includes(Permission.Moderation);

    const general: Command<ApplicationCommandType>[] = [];
    const moderation: Command<ApplicationCommandType>[] = [];
    const administration: Command<ApplicationCommandType>[] = [];

    for (const cmd of client.getCommands().values()) {
      if (!canAccess(cmd)) continue;
      if (isAdminCmd(cmd)) administration.push(cmd);
      else if (isModCmd(cmd)) moderation.push(cmd);
      else general.push(cmd);
    }

    let accessLabel = 'Unregistered';
    if (isAdmin) accessLabel = 'Administration';
    else if (isMod) accessLabel = 'Moderation';
    else if (isMember) accessLabel = 'Member';
    else if (isCommunity) accessLabel = 'Community';

    const embed = new EmbedBuilder()
      .setColor(appFeatureMap[command.options.feature].color)
      .setTitle('Wattson — Available Commands')
      .setDescription(`Showing commands available to the **${accessLabel}** role.`);

    if (general.length > 0) {
      embed.addFields({ name: '📋 General', value: fmtCommands(general) });
    }
    if (moderation.length > 0) {
      embed.addFields({ name: '🔨 Moderation', value: fmtCommands(moderation) });
    }
    if (administration.length > 0) {
      embed.addFields({ name: '⚙️ Administration', value: fmtCommands(administration) });
    }

    embed.setFooter({ text: 'Wattson, in service for Europe' }).setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
});
