import { ApplicationCommandType, MessageFlags, SlashCommandBuilder, TextChannel } from 'discord.js';

import { RuleCategory, listRules } from '~/database';
import { AppFeature, appFeatureMap } from '~/settings';
import { baseLocale } from '~/core/locales';
import { Command } from '~/core/models';
import { toTitleCase } from '~/utilities';

import { RuleHeaderEmbed, RulesEmbed, handlePaginatedEmbeds } from '~/core/components';

const fetchCategorizedRules = async (categories: RuleCategory[]) => {
  const rules = await listRules();

  return Object.groupBy(
    rules.map((r) => ({ ...r, title: `${categories.indexOf(r.category) + 1}.${r.categoryIndex}. ${r.title}` })),
    (r) => r.category
  );
};

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Rules,
  type: ApplicationCommandType.ChatInput,
  middleware: [],
  requiredPermissions: [],
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Manages the ruleset')
    .addBooleanOption((option) =>
      option.setName('permanent').setDescription("Whether the rules should stay permanently. Recommend in '#rules' channels")
    ),
  async executeCommand(command, client, interaction) {
    const categories = Object.values(RuleCategory);
    const categorizedRules = await fetchCategorizedRules(categories);

    const embeds = Object.entries(categorizedRules).map(([category, list], i) => {
      return new RulesEmbed({
        color: appFeatureMap[command.options.feature].color,
        locale: interaction.locale,
        title: `📜 ${toTitleCase(category)}`,
        footerText: `Page ${i + 1} of ${categories.length}`,
        fieldList: list ?? [],
      });
    });
    const embedList = embeds.flatMap((e) => e.render());
    const embedAttachmentList = [...new Set(embeds.flatMap((e) => e.attachments))];

    if (!interaction.options.getBoolean('permanent')) {
      return handlePaginatedEmbeds(embedList, interaction, { flags: MessageFlags.Ephemeral, files: embedAttachmentList });
    }

    const channel = (await client.channels.fetch(interaction.channelId)) as TextChannel;
    const ruleHeaderEmbed = new RuleHeaderEmbed({ color: appFeatureMap[command.options.feature].color, locale: baseLocale });

    await channel.send({ embeds: [ruleHeaderEmbed.render()], files: ruleHeaderEmbed.attachments });

    for (let i = 0; i < embedList.length; i += 10) {
      await channel.send({ embeds: embedList.slice(i, i + 10), ...(i === 0 && { files: embedAttachmentList }) });
    }
  },
});
