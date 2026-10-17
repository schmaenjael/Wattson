import { type CourtCase, setCourtCaseFinalizing } from '~/database';
import { Client } from '~/core/models';
import { attempt } from '~/utilities';
import { buildVoteEmbed, buildVoteRow } from './outcome';

/**
 * Locks the court thread and posts the moderator vote embed, transitioning the case into
 * deliberation. Caller (the command) is responsible for the precondition checks (active thread,
 * not already finalizing) that produce user-facing replies before calling this. Returns false if
 * the case's thread can't be fetched as a thread channel — the caller should treat that as failure.
 */
export const finalizeCourtCase = async (client: Client, caseRow: CourtCase): Promise<boolean> => {
  const thread = await client.channels.fetch(caseRow.threadId);
  if (!thread || !thread.isThread()) return false;

  await attempt(async () => await thread.setLocked(true, 'Court finalization — moderator deliberation in progress'), {
    errorCode: 'COURT_THREAD_LOCK',
    context: { threadId: thread.id, caseId: caseRow.id },
  });

  const tallies = { ban: 0, warn: 0, dismiss: 0 };
  const voteMsg = await thread.send({ embeds: [buildVoteEmbed(caseRow, tallies)], components: [buildVoteRow(caseRow.id)] });

  await setCourtCaseFinalizing(caseRow.id, voteMsg.id);
  return true;
};
