import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

const SYSTEM_PROMPT = `You are Wattson, an AI assistant for the Volt Europa Discord community. Volt Europa is a pan-European political movement. Answer questions concisely, factually, and helpfully. For opinion or political questions, stay neutral and present multiple perspectives. Keep responses focused and avoid unnecessary verbosity.`;

const TIMEOUT_MS = 45_000;

interface OllamaGenerateResponse {
  response?: string;
}

export const queryOllama = async (question: string): Promise<string | null> => {
  const endpoint = process.env.OLLAMA_ENDPOINT;
  const model = process.env.OLLAMA_MODEL;
  if (!endpoint || !model) return null;

  const logger = Logger.getInstance(AppFeature.Ask);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model, system: SYSTEM_PROMPT, prompt: question, stream: false }),
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const body = (await res.json()) as OllamaGenerateResponse;
    if (!body.response) throw new Error('Ollama response missing "response" field');
    return body.response.trim() || null;
  } catch (err) {
    logger.warn(Object(err), 'Ollama query failed.');
    return null;
  } finally {
    clearTimeout(timer);
  }
};
