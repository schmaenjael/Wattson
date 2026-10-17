import { ButtonInteraction, MessageFlags } from 'discord.js';

import { Client } from '~/core/models';
import { CourtStatus, CourtVoteOption, findCaseById, getSettings, getVoteTallies, upsertCourtVote, upsertUser } from '~/database';
import { attempt } from '~/utilities';
import { buildVoteEmbed, buildVoteRow, executeCaseOutcome, VOTE_THRESHOLD } from './outcome';

export const handleCourtVote = async (client: Client, interaction: ButtonInteraction): Promise<void> => {
  const parts = interaction.customId.split(':');
  const caseId = parseInt(parts[1], 10);
  const voteRaw = parts[2];

  if (!Object.values(CourtVoteOption).includes(voteRaw as CourtVoteOption)) return;
  const vote = voteRaw as CourtVoteOption;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const settings = await getSettings();

  const caseRow = await findCaseById(caseId);
  if (!caseRow || caseRow.status !== CourtStatus.Finalizing) {
    await interaction.editReply({ content: 'This vote is no longer active.' });
    return;
  }

  await upsertUser({ id: interaction.user.id, username: interaction.user.username });
  await upsertCourtVote(caseId, interaction.user.id, vote);

  const tallies = await getVoteTallies(caseId);
  const winner = ([CourtVoteOption.Ban, CourtVoteOption.Warn, CourtVoteOption.Dismiss] as const).find((o) => tallies[o] >= VOTE_THRESHOLD);

  await attempt(
    () =>
      interaction.message.edit({
        embeds: [buildVoteEmbed(caseRow, tallies, winner)],
        components: winner ? [buildVoteRow(caseId, true)] : [buildVoteRow(caseId)],
      }),
    { errorCode: 'COURT_VOTE_MESSAGE_EDIT', context: { caseId, messageId: interaction.message.id } }
  );

  if (winner) {
    const failures = await executeCaseOutcome(client, interaction.guild!, caseRow, winner, settings);
    const suffix = failures.length > 0 ? `\n⚠️ ${failures.join('; ')}.` : '';
    await interaction.editReply({ content: `Vote recorded. **${VOTE_THRESHOLD}** votes reached — verdict executed: **${winner}**.${suffix}` });
  } else {
    await interaction.editReply({
      content: `Vote recorded (**${vote}**). Current tally: 🔨 ${tallies.ban} · ⚠️ ${tallies.warn} · 🚫 ${tallies.dismiss} — need ${VOTE_THRESHOLD} to close.`,
    });
  }
};
