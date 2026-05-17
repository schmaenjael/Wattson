import { ApplicationCommandType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command } from '~/core/models';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import { queryOllama } from '~/core/providers/ollama';

const MAX_QUESTION_DISPLAY = 800;
const MAX_ANSWER_DISPLAY = 3_200;

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Ask,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask Wattson a question — answered by the configured AI model.')
    .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true).setMaxLength(1000)),

  async executeCommand(command, _client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const question = interaction.options.getString('question', true);
    const color = appFeatureMap[command.options.feature].color;

    if (!process.env.OLLAMA_ENDPOINT || !process.env.OLLAMA_MODEL) {
      await interaction.reply({
        content: 'AI is not configured on this bot instance (`OLLAMA_ENDPOINT` / `OLLAMA_MODEL` missing).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const answer = await queryOllama(question);

    if (!answer) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(color)
            .setTitle('💬 Ask Wattson')
            .setDescription('The AI model did not return a response. It may be unavailable or timed out.')
            .setTimestamp(),
        ],
      });
      return;
    }

    const questionDisplay = question.length > MAX_QUESTION_DISPLAY ? `${question.slice(0, MAX_QUESTION_DISPLAY)}…` : question;
    const answerDisplay = answer.length > MAX_ANSWER_DISPLAY ? `${answer.slice(0, MAX_ANSWER_DISPLAY)}…` : answer;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('💬 Ask Wattson')
      .setDescription(`**Question**\n${questionDisplay}\n\n**Answer**\n${answerDisplay}`)
      .setFooter({ text: `Powered by ${process.env.OLLAMA_MODEL} · Asked by ${interaction.user.username}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
});
