import { Events } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature } from '~/settings';
import { snapshotInviteDelete } from '~/core/providers/inviteTracking';

export default new Event({ type: Events.InviteDelete, feature: AppFeature.InviteTracking, middleware: [], handlers: [snapshotInviteDelete] });
