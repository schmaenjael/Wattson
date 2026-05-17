import { Events } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature } from '~/settings';
import { getSettings, upsertInviteSnapshot } from '~/database';
import { inviteCache } from '~/core/loaders/inviteCache';

export default new Event({
  type: Events.InviteCreate,
  feature: AppFeature.InviteTracking,
  middleware: [],
  async executeCommand(_event, _client, invite) {
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
  },
});
