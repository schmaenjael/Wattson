import { loadBlocklist } from './loader';
import { BlocklistChecker } from './checker';

export { BlocklistChecker } from './checker';

let instance: BlocklistChecker | null = null;
let loading: Promise<BlocklistChecker | null> | null = null;

function getPaths(): string[] {
  const raw = process.env.BLOCKLIST_PATHS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

export async function getBlocklistChecker(): Promise<BlocklistChecker | null> {
  if (instance) return instance;
  if (loading) return loading;

  const paths = getPaths();
  if (paths.length === 0) return null;

  loading = loadBlocklist(paths).then((domains) => {
    instance = new BlocklistChecker(domains);
    loading = null;
    return instance;
  });

  return loading;
}

export function invalidateBlocklistChecker(): void {
  instance = null;
  loading = null;
}
