import type { Message } from 'discord.js';

import type { Client } from '~/core/models';
import { getConfig } from '~/config';
import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

export interface ModmailMessage {
  author: string;
  role: 'user' | 'moderator';
  content: string;
}

const SYSTEM_PROMPT = `You are a modmail summarizer for a Discord moderation system. Given a conversation between a user and the moderation team, produce a concise bullet-point list of the key points discussed.

Rules:
- Only include what was actually said. Do not add analysis, opinions, or conclusions.
- Skip procedural bot messages (modmail opened/closed notices, commands).
- Each bullet captures one distinct key point, request, or response.
- One sentence per bullet.
- Return only the bullet list, no preamble or closing text.
- If there are no notable points, return exactly: No notable points recorded.`;

export const summarizeModmailThread = async (endpoint: string, model: string, messages: ModmailMessage[]): Promise<string | null> => {
  const logger = Logger.getInstance(AppFeature.Modmail);
  const relevant = messages.filter((m) => m.content.trim().length > 0);
  if (relevant.length === 0) return null;

  const conversation = relevant.map((m) => `[${m.role === 'user' ? 'User' : 'Moderator'} — ${m.author}]: ${m.content}`).join('\n');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getConfig().config.timeouts.summarizerMs);

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
    logger.warn(Object(err), 'Modmail thread summarization failed — skipping summary.');
    return null;
  } finally {
    clearTimeout(timer);
  }
};

// Thread messages are bot-authored embeds. User and mod messages are identified
// by the embed author name ending in " — User" or " — Moderator".
const parseEmbedMessages = (msgs: Message[]): ModmailMessage[] => {
  const result: ModmailMessage[] = [];
  for (const msg of msgs) {
    for (const embed of msg.embeds) {
      const authorName = embed.author?.name ?? '';
      if (authorName.endsWith(' — User') && embed.description) {
        result.push({ author: authorName.slice(0, -7), role: 'user', content: embed.description });
      } else if (authorName.endsWith(' — Moderator') && embed.description) {
        result.push({ author: authorName.slice(0, -12), role: 'moderator', content: embed.description });
      }
    }
  }
  return result;
};

export const fetchModmailSummary = async (client: Client, threadId: string): Promise<string | null> => {
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT;
  const ollamaModel = process.env.OLLAMA_MODEL;
  if (!ollamaEndpoint || !ollamaModel) return null;

  try {
    const channel = await client.channels.fetch(threadId);
    if (!channel || !channel.isThread()) return null;

    const collected: Message[] = [];
    let lastId: string | undefined;

    while (collected.length < 200) {
      const batch = await channel.messages.fetch({ limit: 100, ...(lastId ? { before: lastId } : {}) });
      if (batch.size === 0) break;
      const msgs = [...batch.values()];
      collected.push(...msgs);
      lastId = msgs[msgs.length - 1]?.id;
      if (batch.size < 100) break;
    }

    collected.reverse();

    const threadMessages = parseEmbedMessages(collected);
    return summarizeModmailThread(ollamaEndpoint, ollamaModel, threadMessages);
  } catch {
    return null;
  }
};
