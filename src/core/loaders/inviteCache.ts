import type { Guild } from 'discord.js';

import { AppFeature } from '~/settings';
import { Logger, softFail } from '~/utilities';
import { upsertInviteSnapshot } from '~/database';

export const inviteCache = new Map<string, number>();
export const vanityState = { uses: 0 };

export const initInviteCache = async (guild: Guild): Promise<void> => {
  const logger = Logger.getInstance(AppFeature.InviteTracking);
  const invites = await guild.invites.fetch().catch(softFail(AppFeature.InviteTracking, 'INVITETRACKING_INVITE_FETCH'));
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
        }).catch(softFail(AppFeature.InviteTracking, 'INVITETRACKING_UPSERT_INVITE_SNAPSHOT'));
      }
    }
  }
  const vanityData = await guild.fetchVanityData().catch(softFail(AppFeature.InviteTracking, 'INVITETRACKING_VANITY_FETCH'));
  if (vanityData) {
    vanityState.uses = vanityData.uses;
  }
  logger.info({ count: inviteCache.size }, 'Invite cache initialized');
};
