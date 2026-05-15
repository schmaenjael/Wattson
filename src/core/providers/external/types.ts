import type { StarboardEntry } from '~/database';

export type ExternalPlatformKind = 'bsky' | 'instagram' | 'haiilo';

export interface ExternalPostPayload {
  entry: StarboardEntry;
  content: string;
  authorName: string;
  sourceUrl: string;
  mediaUrls: string[];
}

export interface ExternalPoster {
  readonly platform: ExternalPlatformKind;
  post(payload: ExternalPostPayload): Promise<{ remoteId: string }>;
}
