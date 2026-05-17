import { Events } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature } from '~/settings';
import { getSettings, insertMemberJoin } from '~/database';
import { inviteCache, vanityState } from '~/core/loaders/inviteCache';

export default new Event({
  type: Events.GuildMemberAdd,
  feature: AppFeature.InviteTracking,
  middleware: [],
  async executeCommand(_event, _client, member) {
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
  },
});
