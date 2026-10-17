import { AppFeature } from '~/settings';
import { logSoftFailure } from '~/utilities';
// Two alternatives: a scheme/www-prefixed URL, or a bare hostname (`000-sex-you-tube.blogspot.com`).
// The bare branch is deliberately permissive — `filename.js` matches it too — because the blocklist Set
// is the actual gate: a candidate that is not an exact blocked domain simply never fires.
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"')\],]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"')\],]*)?/gi;

function extractDomain(raw: string): string | null {
  try {
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    // A trailing dot is the legal FQDN root (`example.com.`) and survives URL parsing; blocklists omit it.
    const hostname = new URL(url).hostname.toLowerCase().replace(/\.+$/, '');
    return hostname.replace(/^www\d*\./, '');
  } catch (error) {
    logSoftFailure(AppFeature.LinkFilter, 'BLOCKLIST_DOMAIN_PARSE_FAILED', { raw }, error, 'debug');
    return null;
  }
}

export class BlocklistChecker {
  constructor(private readonly domains: Set<string>) {}

  get size(): number {
    return this.domains.size;
  }

  findBlockedDomain(content: string): string | null {
    for (const match of content.matchAll(URL_PATTERN)) {
      const domain = extractDomain(match[0]);
      if (domain && this.domains.has(domain)) return domain;
    }
    return null;
  }
}
