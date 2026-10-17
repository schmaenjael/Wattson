import { getConfig } from '~/config';
import { AppFeature } from '~/settings';
import { logSoftFailure } from '~/utilities';

interface RagQueryResponse {
  answer: string;
  sources: string[];
  chunks_used: number;
}

export interface RagResult {
  answer: string;
  sources: string[];
}

/** Public contract for the RAG (retrieval-augmented Q&A) service. */
export interface RagClient {
  query(question: string): Promise<RagResult | null>;
}

const query = async (question: string): Promise<RagResult | null> => {
  const endpoint = process.env.RAG_ENDPOINT;
  if (!getConfig().config.features.rag || !endpoint) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getConfig().config.timeouts.ragMs);

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
    logSoftFailure(AppFeature.Ask, 'RAG_QUERY', { endpoint }, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const ragClient: RagClient = { query };
