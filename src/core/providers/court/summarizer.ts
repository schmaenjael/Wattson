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
  const logger = Logger.getInstance(AppFeature.System);
  const relevant = messages.filter((m) => m.content.trim().length > 0);
  if (relevant.length === 0) return null;

  const conversation = relevant.map((m) => `[${m.author}]: ${m.content}`).join('\n');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model, prompt: `${SYSTEM_PROMPT}\n\nCONVERSATION:\n${conversation}`, stream: false }),
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const body = (await res.json()) as { response?: string };
    if (!body.response) throw new Error('Ollama response missing "response" field');
    return body.response.trim() || null;
  } catch (err) {
    logger.warn(Object(err), 'Court thread summarization failed — skipping summary.');
    return null;
  } finally {
    clearTimeout(timer);
  }
};
