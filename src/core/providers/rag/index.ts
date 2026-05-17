import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

const TIMEOUT_MS = 60_000;

interface RagQueryResponse {
  answer: string;
  sources: string[];
  chunks_used: number;
}

export interface RagResult {
  answer: string;
  sources: string[];
}

export const queryRag = async (question: string): Promise<RagResult | null> => {
  const endpoint = process.env.RAG_ENDPOINT;
  if (!endpoint) {
    return null;
  }

  const logger = Logger.getInstance(AppFeature.Ask);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ question }),
    });

    if (!res.ok) {
      throw new Error(`RAG HTTP ${res.status}`);
    }

    const body = (await res.json()) as RagQueryResponse;
    return { answer: body.answer, sources: body.sources };
  } catch (err) {
    logger.warn(Object(err), 'RAG query failed.');
    return null;
  } finally {
    clearTimeout(timer);
  }
};
