const spamWindows = new Map<string, Map<string, number[]>>();

export function recordAndCheck(userId: string, channelId: string, maxMessages: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  if (!spamWindows.has(userId)) {
    spamWindows.set(userId, new Map());
  }

  const userMap = spamWindows.get(userId)!;
  const timestamps = (userMap.get(channelId) ?? []).filter((t) => t > cutoff);
  timestamps.push(now);
  userMap.set(channelId, timestamps);

  return timestamps.length >= maxMessages;
}

export function clearUserChannelWindow(userId: string, channelId: string): void {
  spamWindows.get(userId)?.delete(channelId);
}
