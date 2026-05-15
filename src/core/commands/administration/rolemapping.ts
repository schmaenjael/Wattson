import { ApplicationCommandType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command } from '~/core/models';
import { useAdmin } from '~/core/middleware';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import { deleteRoleMapping, listRoleMappings, upsertRoleMapping, RoleMappingType } from '~/database';

const TYPE_CHOICES = [
  { name: 'Country', value: RoleMappingType.Country },
  { name: 'Language', value: RoleMappingType.Language },
  { name: 'Pronouns', value: RoleMappingType.Pronouns },
] as const;

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.System,
  type: ApplicationCommandType.ChatInput,
  middleware: [useAdmin],
  data: new SlashCommandBuilder()
    .setName('rolemapping')
    .setDescription('Map verification answers (country, language, pronouns) to Discord roles.')
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Map a verification answer value to a Discord role.')
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription('Answer category')
            .setRequired(true)
            .addChoices(...TYPE_CHOICES)
        )
        .addStringOption((o) =>
          o
            .setName('value')
            .setDescription('Answer value (e.g. de for Germany, she for she/her, eo for Esperanto)')
            .setRequired(true)
            .setMaxLength(50)
        )
        .addRoleOption((o) => o.setName('role').setDescription('Discord role to assign').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove a role mapping.')
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription('Answer category')
            .setRequired(true)
            .addChoices(...TYPE_CHOICES)
        )
        .addStringOption((o) => o.setName('value').setDescription('Answer value to unmap').setRequired(true).setMaxLength(50))
    )
    .addSubcommand((s) =>
      s
        .setName('list')
        .setDescription('List all role mappings.')
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription('Filter by category (optional)')
            .addChoices(...TYPE_CHOICES)
        )
    ),

  async executeCommand(command, _client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const color = appFeatureMap[command.options.feature].color;
    const sub = interaction.options.getSubcommand(true);

    if (sub === 'add') {
      const type = interaction.options.getString('type', true) as RoleMappingType;
      const value = interaction.options.getString('value', true).toLowerCase().trim();
      const role = interaction.options.getRole('role', true);

      await upsertRoleMapping({ type, value, roleId: role.id });
      await interaction.reply({ content: `Mapped **${type}:\`${value}\`** → ${role} (${role.id}).`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'remove') {
      const type = interaction.options.getString('type', true) as RoleMappingType;
      const value = interaction.options.getString('value', true).toLowerCase().trim();

      const deleted = await deleteRoleMapping(type, value);
      await interaction.reply({
        content: deleted ? `Removed mapping **${type}:\`${value}\`**.` : `No mapping found for **${type}:\`${value}\`**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'list') {
      const typeFilter = interaction.options.getString('type') as RoleMappingType | null;
      const rows = await listRoleMappings(typeFilter ?? undefined);

      const embed = new EmbedBuilder().setColor(color).setTitle('Role Mappings').setTimestamp();

      if (rows.length === 0) {
        embed.setDescription('*No mappings configured.*');
      } else {
        const grouped = new Map<RoleMappingType, typeof rows>();
        for (const row of rows) {
          const bucket = grouped.get(row.type) ?? [];
          bucket.push(row);
          grouped.set(row.type, bucket);
        }
        for (const [type, entries] of grouped) {
          embed.addFields({
            name: type.charAt(0).toUpperCase() + type.slice(1),
            value: entries.map((e) => `\`${e.value}\` → <@&${e.roleId}>`).join('\n'),
          });
        }
      }

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }
  },
});
