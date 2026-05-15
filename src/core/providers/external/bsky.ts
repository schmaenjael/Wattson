import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

import type { ExternalPoster, ExternalPostPayload } from './types';

/**
 * Stub poster. Real implementation will use @atproto/api once credentials are
 * available; until then we log the intent and return a fake remoteId so the
 * upstream dedupe logic still works.
 */
export class BskyStub implements ExternalPoster {
  public readonly platform = 'bsky' as const;

  async post(payload: ExternalPostPayload): Promise<{ remoteId: string }> {
    Logger.getInstance(AppFeature.System).info({ platform: this.platform, sourceUrl: payload.sourceUrl }, '[stub] would post to BSKY');
    return { remoteId: `bsky-stub-${payload.entry.sourceMessageId}` };
  }
}
