import { ApplicationCommandType, MessageFlags, SlashCommandBuilder, Snowflake, TextChannel } from 'discord.js';
import { eq } from 'drizzle-orm';

import DatabaseClient, { tblGuild, RuleCategory, tblRules } from '~/database';
import { useGuildOnlyChatInput } from '~/core/middleware';
import { AppFeature, appFeatureMap } from '~/settings';
import { baseLocale } from '~/core/locales';
import { Command } from '~/core/models';
import { Utils } from '~/utilities';

import { RuleHeaderEmbed, RulesEmbed, handlePaginatedEmbeds } from '~/core/components';

const fetchCategorizedRules = async (guildId: Snowflake, categories: RuleCategory[]) => {
  const db = DatabaseClient.getInstance();

  const rules = await db
    .select({
      title: tblRules.title,
      categoryIndex: tblRules.categoryIndex,
      content: tblRules.content,
      category: tblRules.category,
      example: tblRules.example,
    })
    .from(tblRules)
    .where(eq(tblRules.fkGuildId, guildId));

  const categorizedRules = Object.groupBy<RuleCategory, (typeof rules)[0]>(
    rules.map((r) => ({ ...r, title: `${categories.indexOf(r.category) + 1}.${r.categoryIndex}. ${r.title}` })),
    (r) => r.category as RuleCategory
  );

  return categorizedRules;
};

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Rules,
  type: ApplicationCommandType.ChatInput,
  middleware: [useGuildOnlyChatInput],
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Manages the ruleset')
    .addBooleanOption((option) =>
      option.setName('permanent').setDescription("Whether the rules should stay permanently. Recommend in '#rules' channels")
    ),
  async executeCommand(command, client, interaction) {
    const categories = Object.values(RuleCategory);
    const categorizedRules = await fetchCategorizedRules(interaction?.guildId!, categories);

    const embeds = Object.entries(categorizedRules).map(([category, list], i) => {
      return new RulesEmbed({
        color: appFeatureMap[command.options.feature].color,
        locale: interaction.locale,
        title: `📜 ${Utils.toTitleCase(category)}`,
        footerText: `Page ${i + 1} of ${categories.length}`,
        fieldList: list,
      });
    });
    const embedList = embeds.flatMap((e) => e.render());
    const embedAttachmentList = [...new Set(embeds.flatMap((e) => e.attachments))];

    if (!interaction.options.getBoolean('permanent')) {
      return await handlePaginatedEmbeds(embedList, interaction, { flags: MessageFlags.Ephemeral, files: embedAttachmentList });
    }

    const channel = (await client.channels.fetch(interaction.channelId)) as TextChannel;
    const ruleHeaderEmbed = new RuleHeaderEmbed({ color: appFeatureMap[command.options.feature].color, locale: baseLocale });

    channel.send({ embeds: [ruleHeaderEmbed.render()], files: ruleHeaderEmbed.attachments });
    await channel.send({ embeds: embedList, files: embedAttachmentList });
  },
});
