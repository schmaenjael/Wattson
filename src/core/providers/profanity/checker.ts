import type { CompiledPattern } from './loader';

export interface ProfanityMatch {
  word: string;
  severity: number;
}

export class ProfanityChecker {
  constructor(private readonly patterns: CompiledPattern[]) {}

  get size(): number {
    return this.patterns.length;
  }

  check(content: string): ProfanityMatch | null {
    let worst: ProfanityMatch | null = null;

    for (const p of this.patterns) {
      if (!p.regex.test(content)) continue;
      if (!worst || p.severity > worst.severity) {
        worst = { word: p.raw, severity: p.severity };
      }
    }

    return worst;
  }
}
