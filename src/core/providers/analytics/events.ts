import { Message, MessageReaction, PartialMessageReaction, PartialUser, User, VoiceState } from 'discord.js';

import { Client } from '~/core/models';
import { endVoiceSession, recordMessage, recordReaction, startVoiceSession } from '~/core/providers/analytics';

/** Counts a human message toward daily activity. */
export const recordMessageActivity = (_client: Client, message: Message): void => {
  if (!message.inGuild()) return;
  if (message.author.bot || message.system) return;
  if (!message.content) return;
  recordMessage(message.author.id);
};

/** Counts a human reaction toward daily activity. */
export const recordReactionActivity = (_client: Client, _reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): void => {
  if (user.bot) return;
  recordReaction(user.id);
};

/** Tracks voice-channel join/leave/move transitions for daily voice-time accounting. */
export const recordVoiceActivity = (_client: Client, oldState: VoiceState, newState: VoiceState): void => {
  const member = newState.member ?? oldState.member;
  if (member?.user.bot) return;

  const userId = newState.id;
  const oldChannel = oldState.channelId;
  const newChannel = newState.channelId;
  if (oldChannel === newChannel) return;

  if (!oldChannel && newChannel) {
    startVoiceSession(userId);
  } else if (oldChannel && !newChannel) {
    endVoiceSession(userId);
  } else {
    startVoiceSession(userId);
  }
};
