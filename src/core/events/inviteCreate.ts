import { Events } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature } from '~/settings';
import { snapshotInviteCreate } from '~/core/providers/inviteTracking';

export default new Event({ type: Events.InviteCreate, feature: AppFeature.InviteTracking, middleware: [], handlers: [snapshotInviteCreate] });
