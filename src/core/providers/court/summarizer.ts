import { getConfig } from '~/config';
import { callOllamaGenerate } from '~/core/providers/ollama';
import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

export interface CourtThreadMessage {
  author: string;
  content: string;
}

const SYSTEM_PROMPT = `You are a court case summarizer for a Discord moderation system. Given a thread conversation from a court case, produce a concise bullet-point list of the notable points made by participants.

Rules:
- Only include what was actually said. Do not add analysis, opinions, verdicts, or conclusions.
- Skip procedural bot messages (case opened/closed notices, commands).
- Each bullet point captures one distinct notable claim or statement made by a participant.
- One sentence per bullet.
- Return only the bullet list, no preamble or closing text.
- If there are no notable points, return exactly: No notable points recorded.`;

export const summarizeCourtThread = async (endpoint: string, model: string, messages: CourtThreadMessage[]): Promise<string | null> => {
  const relevant = messages.filter((m) => m.content.trim().length > 0);
  if (relevant.length === 0) return null;

  const conversation = relevant.map((m) => `[${m.author}]: ${m.content}`).join('\n');

  return callOllamaGenerate({
    endpoint,
    model,
    prompt: `${SYSTEM_PROMPT}\n\nCONVERSATION:\n${conversation}`,
    timeoutMs: getConfig().config.timeouts.summarizerMs,
    logger: Logger.getInstance(AppFeature.System),
    failureMessage: 'Court thread summarization failed — skipping summary.',
  });
};
