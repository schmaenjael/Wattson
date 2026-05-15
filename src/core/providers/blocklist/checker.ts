const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"')\],]+/gi;

function extractDomain(raw: string): string | null {
  try {
    const url = raw.startsWith('www.') ? `https://${raw}` : raw;
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.replace(/^www\d*\./, '');
  } catch {
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
