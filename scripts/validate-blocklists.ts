import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BAD_WORDS_DIR = join(process.cwd(), 'config', 'bad-words');
const BLOCKLISTS_DIR = join(process.cwd(), 'config', 'blocklists');

const getFiles = async (dir: string): Promise<string[]> => {
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith('.txt') && !f.startsWith('.')).map((f) => join(dir, f));
  } catch {
    return [];
  }
};

type Occurrence = { file: string; line: number };

const checkDuplicates = async (files: string[], extractKey: (tokens: string[]) => string | null, label: string): Promise<number> => {
  const seen = new Map<string, Occurrence[]>();

  for (const filePath of files) {
    const text = await readFile(filePath, 'utf-8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const tokens = trimmed.split(/\s+/);
      const key = extractKey(tokens);
      if (!key) continue;
      const existing = seen.get(key) ?? [];
      existing.push({ file: filePath, line: i + 1 });
      seen.set(key, existing);
    }
  }

  let dupeCount = 0;
  for (const [key, occurrences] of seen) {
    if (occurrences.length > 1) {
      dupeCount++;
      console.log(`[${label}] Duplicate: "${key}"`);
      for (const { file, line } of occurrences) {
        console.log(`  → ${file}:${line}`);
      }
    }
  }

  return dupeCount;
};

const extractBadWordKey = (tokens: string[]): string | null => {
  if (tokens.length < 2) return null;
  const isRegex = tokens[tokens.length - 1] === 'r';
  const patternParts = isRegex ? tokens.slice(0, -2) : tokens.slice(0, -1);
  return patternParts.join(' ').toLowerCase();
};

const extractDomainKey = (tokens: string[]): string | null => {
  if (tokens.length < 2) return null;
  return tokens[1].toLowerCase();
};

const main = async (): Promise<void> => {
  const badWordFiles = await getFiles(BAD_WORDS_DIR);
  const blocklistFiles = await getFiles(BLOCKLISTS_DIR);

  console.log(`Checking ${badWordFiles.length} bad-word file(s) and ${blocklistFiles.length} blocklist file(s)...`);

  const badWordDupes = await checkDuplicates(badWordFiles, extractBadWordKey, 'bad-words');
  const blocklistDupes = await checkDuplicates(blocklistFiles, extractDomainKey, 'blocklists');

  const total = badWordDupes + blocklistDupes;
  if (total > 0) {
    console.error(`\n✗ Found ${total} duplicate(s). Fix before deploying.`);
    process.exit(1);
  } else {
    console.log('\n✓ No duplicates found.');
  }
};

main();
