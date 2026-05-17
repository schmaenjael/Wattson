export const SLOWMODE_TIERS = [5, 15, 30, 60] as const;

const STEP_DOWN_DELAY_FACTOR = 2;

interface ChannelState {
  level: number;
  timestamps: number[];
  lastActionAt: number;
}

const channelStates = new Map<string, ChannelState>();

export type SlowmodeAction =
  | { type: 'step_up'; level: number; slowmodeSeconds: number }
  | { type: 'step_down'; level: number; slowmodeSeconds: number }
  | { type: 'restore' }
  | null;

export function recordAndCheckSlowmode(channelId: string, threshold: number, windowMs: number): SlowmodeAction {
  const now = Date.now();
  const cutoff = now - windowMs;

  let state = channelStates.get(channelId);
  if (!state) {
    state = { level: 0, timestamps: [], lastActionAt: 0 };
    channelStates.set(channelId, state);
  }

  state.timestamps = state.timestamps.filter((t) => t > cutoff);
  state.timestamps.push(now);

  if (state.timestamps.length >= threshold) {
    state.lastActionAt = now;
    if (state.level < SLOWMODE_TIERS.length) {
      state.level++;
      return { type: 'step_up', level: state.level, slowmodeSeconds: SLOWMODE_TIERS[state.level - 1] };
    }
    return null;
  }

  if (state.level > 0 && now - state.lastActionAt > windowMs * STEP_DOWN_DELAY_FACTOR) {
    state.level--;
    state.lastActionAt = now;
    if (state.level === 0) {
      return { type: 'restore' };
    }
    return { type: 'step_down', level: state.level, slowmodeSeconds: SLOWMODE_TIERS[state.level - 1] };
  }

  return null;
}

export function clearChannelSlowmodeState(channelId: string): void {
  channelStates.delete(channelId);
}
