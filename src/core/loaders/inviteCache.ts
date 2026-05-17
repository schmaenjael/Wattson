import type { Guild } from 'discord.js';

import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';
import { upsertInviteSnapshot } from '~/database';

export const inviteCache = new Map<string, number>();
export const vanityState = { uses: 0 };

export const initInviteCache = async (guild: Guild): Promise<void> => {
  const logger = Logger.getInstance(AppFeature.InviteTracking);
  const invites = await guild.invites.fetch().catch(() => null);
  if (invites) {
    for (const invite of invites.values()) {
      inviteCache.set(invite.code, invite.uses ?? 0);
      if (invite.inviter) {
        await upsertInviteSnapshot({
          code: invite.code,
          inviterId: invite.inviter.id,
          channelId: invite.channel?.id ?? null,
          maxUses: invite.maxUses ?? 0,
          maxAge: invite.maxAge ?? 0,
          createdAt: invite.createdAt ?? new Date(),
        }).catch(() => null);
      }
    }
  }
  const vanityData = await guild.fetchVanityData().catch(() => null);
  if (vanityData) {
    vanityState.uses = vanityData.uses;
  }
  logger.info({ count: inviteCache.size }, 'Invite cache initialized');
};
