import { BskyStub } from './bsky';
import { HaiiloStub } from './haiilo';
import { InstagramStub } from './instagram';
import type { ExternalPlatformKind, ExternalPoster } from './types';

export * from './types';
export { BskyStub, HaiiloStub, InstagramStub };

const POSTERS: Record<ExternalPlatformKind, ExternalPoster> = { bsky: new BskyStub(), instagram: new InstagramStub(), haiilo: new HaiiloStub() };

export const getAllPosters = (): ExternalPoster[] => Object.values(POSTERS);
export const getPoster = (platform: ExternalPlatformKind): ExternalPoster => POSTERS[platform];
