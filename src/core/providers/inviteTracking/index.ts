import { GuildMember, Invite } from 'discord.js';

import { Client } from '~/core/models';
import { getSettings, insertMemberJoin, markInviteDeleted, upsertInviteSnapshot } from '~/database';
import { inviteCache, vanityState } from '~/core/loaders/inviteCache';

/** Resolves which invite a joining member used by diffing cached vs fresh invite uses, then records the join. */
export const trackMemberJoin = async (_client: Client, member: GuildMember): Promise<void> => {
  const settings = await getSettings();
  if (!settings.featureInviteTrackingEnabled) return;

  let usedCode = 'UNKNOWN';
  let inviterId: string | null = null;

  const freshInvites = await member.guild.invites.fetch().catch(() => null);
  if (freshInvites) {
    for (const invite of freshInvites.values()) {
      const cachedUses = inviteCache.get(invite.code) ?? 0;
      const freshUses = invite.uses ?? 0;
      inviteCache.set(invite.code, freshUses);
      if (freshUses > cachedUses) {
        usedCode = invite.code;
        inviterId = invite.inviter?.id ?? null;
        break;
      }
    }
  }

  if (usedCode === 'UNKNOWN') {
    const vanityData = await member.guild.fetchVanityData().catch(() => null);
    if (vanityData && vanityData.uses > vanityState.uses) {
      usedCode = 'VANITY';
      vanityState.uses = vanityData.uses;
    }
  }

  await insertMemberJoin({ userId: member.id, inviteCode: usedCode, inviterId, hadAvatar: member.user.avatar !== null });
};

/** Caches a freshly created invite and snapshots its metadata. */
export const snapshotInviteCreate = async (_client: Client, invite: Invite): Promise<void> => {
  const settings = await getSettings();
  if (!settings.featureInviteTrackingEnabled) return;

  inviteCache.set(invite.code, invite.uses ?? 0);

  if (invite.inviter) {
    await upsertInviteSnapshot({
      code: invite.code,
      inviterId: invite.inviter.id,
      channelId: invite.channel?.id ?? null,
      maxUses: invite.maxUses ?? 0,
      maxAge: invite.maxAge ?? 0,
      createdAt: invite.createdAt ?? new Date(),
    });
  }
};

/** Evicts a deleted invite from the cache and marks it deleted in the snapshot table. */
export const snapshotInviteDelete = async (_client: Client, invite: Invite): Promise<void> => {
  const settings = await getSettings();
  if (!settings.featureInviteTrackingEnabled) return;

  inviteCache.delete(invite.code);
  await markInviteDeleted(invite.code);
};
