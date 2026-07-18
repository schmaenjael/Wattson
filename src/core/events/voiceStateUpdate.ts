import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { recordVoiceActivity } from '~/core/providers/analytics';

export default new Event({ type: Events.VoiceStateUpdate, feature: AppFeature.Analytics, middleware: [], handlers: [recordVoiceActivity] });
