import { logSoftFailure, Logger } from '~/utilities';
import { AppFeature } from '~/settings';

const IP_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;

function normalizeDomain(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s || s.startsWith('#')) return null;

  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^www\d*\./, '');

  const slashIdx = s.indexOf('/');
  if (slashIdx !== -1) s = s.slice(0, slashIdx);

  const colonIdx = s.lastIndexOf(':');
  if (colonIdx !== -1) s = s.slice(0, colonIdx);

  s = s.trim();
  if (!s) return null;
  if (IP_PATTERN.test(s)) return null;
  if (!s.includes('.')) return null;

  return s;
}

export async function loadBlocklist(paths: string[]): Promise<Set<string>> {
  const logger = Logger.getInstance(AppFeature.LinkFilter);
  const domains = new Set<string>();

  for (const filePath of paths) {
    let text: string;
    try {
      text = await import('node:fs/promises').then((fs) => fs.readFile(filePath, 'utf-8'));
    } catch (err) {
      logSoftFailure(AppFeature.LinkFilter, 'BLOCKLIST_FILE_READ', { filePath }, err, 'error');
      continue;
    }

    let count = 0;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;

      const domain = normalizeDomain(parts[1]);
      if (domain) {
        domains.add(domain);
        count++;
      }
    }

    logger.info({ filePath, count }, 'Blocklist loaded.');
  }

  return domains;
}
