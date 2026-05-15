import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

import type { ExternalPoster, ExternalPostPayload } from './types';

/**
 * Stub poster for the Volt Europa Haiilo intranet. Replace with the Haiilo API
 * integration once endpoints + API keys are documented.
 */
export class HaiiloStub implements ExternalPoster {
  public readonly platform = 'haiilo' as const;

  async post(payload: ExternalPostPayload): Promise<{ remoteId: string }> {
    Logger.getInstance(AppFeature.System).info({ platform: this.platform, sourceUrl: payload.sourceUrl }, '[stub] would post to Haiilo');
    return { remoteId: `haiilo-stub-${payload.entry.sourceMessageId}` };
  }
}
