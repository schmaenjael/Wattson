import { Events, MessageFlags, PermissionFlagsBits } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature } from '~/settings';
import { CourtStatus, CourtVoteOption, findCaseById, getSettings, getVoteTallies, upsertCourtVote, upsertUser } from '~/database';
import { buildVoteEmbed, buildVoteRow, executeCaseOutcome, VOTE_THRESHOLD } from '~/core/providers/court/outcome';

export default new Event({
  type: Events.InteractionCreate,
  feature: AppFeature.System,
  middleware: [],
  async executeCommand(_event, client, interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('court_vote:')) return;

    const parts = interaction.customId.split(':');
    const caseId = parseInt(parts[1], 10);
    const voteRaw = parts[2];

    if (!Object.values(CourtVoteOption).includes(voteRaw as CourtVoteOption)) return;
    const vote = voteRaw as CourtVoteOption;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const settings = await getSettings();

    const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
    const hasManageGuild = member?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;
    const hasModRole = settings.roleModerationId ? (member?.roles.cache.has(settings.roleModerationId) ?? false) : false;

    if (!hasManageGuild && !hasModRole) {
      await interaction.editReply({ content: 'Only moderators may vote.' });
      return;
    }

    const caseRow = await findCaseById(caseId);
    if (!caseRow || caseRow.status !== CourtStatus.Finalizing) {
      await interaction.editReply({ content: 'This vote is no longer active.' });
      return;
    }

    await upsertUser({ id: interaction.user.id, username: interaction.user.username });
    await upsertCourtVote(caseId, interaction.user.id, vote);

    const tallies = await getVoteTallies(caseId);
    const winner = ([CourtVoteOption.Ban, CourtVoteOption.Warn, CourtVoteOption.Dismiss] as const).find((o) => tallies[o] >= VOTE_THRESHOLD);

    try {
      await interaction.message.edit({
        embeds: [buildVoteEmbed(caseRow, tallies, winner)],
        components: winner ? [buildVoteRow(caseId, true)] : [buildVoteRow(caseId)],
      });
    } catch {
      // best-effort edit
    }

    if (winner) {
      await interaction.editReply({ content: `Vote recorded. **${VOTE_THRESHOLD}** votes reached — executing verdict: **${winner}**.` });
      await executeCaseOutcome(client, interaction.guild!, caseRow, winner, settings);
    } else {
      await interaction.editReply({
        content: `Vote recorded (**${vote}**). Current tally: 🔨 ${tallies.ban} · ⚠️ ${tallies.warn} · 🚫 ${tallies.dismiss} — need ${VOTE_THRESHOLD} to close.`,
      });
    }
  },
});
