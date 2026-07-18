import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { loadBlocklist } from './loader';
import { BlocklistChecker } from './checker';

const BLOCKLISTS_DIR = join(process.cwd(), 'config', 'blocklists');

let instance: BlocklistChecker | null = null;
let loading: Promise<BlocklistChecker | null> | null = null;

async function resolveBlocklistPaths(): Promise<string[]> {
  try {
    const entries = await readdir(BLOCKLISTS_DIR);
    return entries.filter((f) => f.endsWith('.txt') && !f.startsWith('.')).map((f) => join(BLOCKLISTS_DIR, f));
  } catch {
    return [];
  }
}

export async function getBlocklistChecker(): Promise<BlocklistChecker | null> {
  if (instance) return instance;
  if (loading) return loading;

  loading = resolveBlocklistPaths().then(async (paths) => {
    loading = null;
    if (paths.length === 0) return null;
    const domains = await loadBlocklist(paths);
    instance = new BlocklistChecker(domains);
    return instance;
  });

  return loading;
}

export function invalidateBlocklistChecker(): void {
  instance = null;
  loading = null;
}
