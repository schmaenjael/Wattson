import { flushActivityDeltas, type ActivityDelta } from '~/database';
import { getConfig } from '~/config';

export * from './events';

const messageDeltas = new Map<string, number>();
const reactionDeltas = new Map<string, number>();
const voiceAccumMs = new Map<string, number>();
const voiceSessions = new Map<string, number>();

const bump = (map: Map<string, number>, key: string, by: number): void => {
  map.set(key, (map.get(key) ?? 0) + by);
};

const utcDay = (): string => new Date().toISOString().slice(0, 10);

export const recordMessage = (userId: string): void => {
  bump(messageDeltas, userId, 1);
};

export const recordReaction = (userId: string): void => {
  bump(reactionDeltas, userId, 1);
};

export const startVoiceSession = (userId: string): void => {
  if (!getConfig().config.features.analytics) return;

  if (!voiceSessions.has(userId)) {
    voiceSessions.set(userId, Date.now());
  }
};

export const endVoiceSession = (userId: string): void => {
  const start = voiceSessions.get(userId);
  if (start === undefined) {
    return;
  }
  bump(voiceAccumMs, userId, Date.now() - start);
  voiceSessions.delete(userId);
};

export const checkpointVoiceSessions = (): void => {
  const now = Date.now();
  for (const [userId, start] of voiceSessions) {
    bump(voiceAccumMs, userId, now - start);
    voiceSessions.set(userId, now);
  }
};

export const drainBuffers = (): ActivityDelta[] => {
  const day = utcDay();
  const userIds = new Set<string>([...messageDeltas.keys(), ...reactionDeltas.keys(), ...voiceAccumMs.keys()]);

  const deltas: ActivityDelta[] = [];
  for (const userId of userIds) {
    deltas.push({
      userId,
      day,
      messageDelta: messageDeltas.get(userId) ?? 0,
      voiceDelta: Math.floor((voiceAccumMs.get(userId) ?? 0) / 1000),
      reactionDelta: reactionDeltas.get(userId) ?? 0,
    });
  }

  messageDeltas.clear();
  reactionDeltas.clear();
  voiceAccumMs.clear();

  return deltas.filter((d) => d.messageDelta > 0 || d.voiceDelta > 0 || d.reactionDelta > 0);
};

export const flushAnalytics = async (): Promise<number> => {
  checkpointVoiceSessions();
  const deltas = drainBuffers();
  await flushActivityDeltas(deltas);
  return deltas.length;
};
