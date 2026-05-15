import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

import type { ExternalPoster, ExternalPostPayload } from './types';

/**
 * Stub poster. Replace with Meta Graph API integration when credentials arrive.
 */
export class InstagramStub implements ExternalPoster {
  public readonly platform = 'instagram' as const;

  async post(payload: ExternalPostPayload): Promise<{ remoteId: string }> {
    Logger.getInstance(AppFeature.System).info({ platform: this.platform, sourceUrl: payload.sourceUrl }, '[stub] would post to Instagram');
    return { remoteId: `instagram-stub-${payload.entry.sourceMessageId}` };
  }
}
