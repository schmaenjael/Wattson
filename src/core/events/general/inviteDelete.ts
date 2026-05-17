import { Events } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature } from '~/settings';
import { getSettings, markInviteDeleted } from '~/database';
import { inviteCache } from '~/core/loaders/inviteCache';

export default new Event({
  type: Events.InviteDelete,
  feature: AppFeature.InviteTracking,
  middleware: [],
  async executeCommand(_event, _client, invite) {
    const settings = await getSettings();
    if (!settings.featureInviteTrackingEnabled) return;

    inviteCache.delete(invite.code);
    await markInviteDeleted(invite.code);
  },
});
