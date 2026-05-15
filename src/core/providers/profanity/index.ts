import { loadProfanityList } from './loader';
import { ProfanityChecker } from './checker';

export { ProfanityChecker } from './checker';
export type { ProfanityMatch } from './checker';

const PATH_ENV = 'PROFANITY_LIST_PATH';

let instance: ProfanityChecker | null = null;
let loading: Promise<ProfanityChecker | null> | null = null;

export async function getProfanityChecker(): Promise<ProfanityChecker | null> {
  if (instance) return instance;
  if (loading) return loading;

  const filePath = process.env[PATH_ENV];
  if (!filePath) return null;

  loading = loadProfanityList(filePath).then((patterns) => {
    instance = new ProfanityChecker(patterns);
    loading = null;
    return instance;
  });

  return loading;
}

export function invalidateProfanityChecker(): void {
  instance = null;
  loading = null;
}
