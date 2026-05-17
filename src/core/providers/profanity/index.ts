import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { loadProfanityList } from './loader';
import { ProfanityChecker } from './checker';

export { ProfanityChecker } from './checker';
export type { ProfanityMatch } from './checker';

const BAD_WORDS_DIR = join(process.cwd(), 'config', 'bad-words');

let instance: ProfanityChecker | null = null;
let loading: Promise<ProfanityChecker | null> | null = null;

async function resolveWordlistPaths(): Promise<string[]> {
  try {
    const entries = await readdir(BAD_WORDS_DIR);
    return entries.filter((f) => f.endsWith('.txt') && !f.startsWith('.')).map((f) => join(BAD_WORDS_DIR, f));
  } catch {
    return [];
  }
}

export async function getProfanityChecker(): Promise<ProfanityChecker | null> {
  if (instance) return instance;
  if (loading) return loading;

  loading = resolveWordlistPaths().then(async (paths) => {
    loading = null;
    if (paths.length === 0) return null;
    const allPatterns = (await Promise.all(paths.map(loadProfanityList))).flat();
    instance = new ProfanityChecker(allPatterns);
    return instance;
  });

  return loading;
}

export function invalidateProfanityChecker(): void {
  instance = null;
  loading = null;
}
