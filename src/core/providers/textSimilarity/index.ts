const buildLcsTable = (a: string[], b: string[]): number[][] => {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
};

export const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_row, i) => Array.from({ length: n + 1 }, (_col, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
};

export const jaccardWordDistance = (a: string, b: string): number => {
  const aSet = new Set(a.toLowerCase().match(/\S+/g) ?? []);
  const bSet = new Set(b.toLowerCase().match(/\S+/g) ?? []);
  const intersectionSize = [...aSet].filter((w) => bSet.has(w)).length;
  const unionSize = new Set([...aSet, ...bSet]).size;
  return unionSize === 0 ? 0 : 1 - intersectionSize / unionSize;
};

/** Diffs two strings word-by-word. Changed words are wrapped in **bold** in their respective outputs. */
export const diffWords = (a: string, b: string): { before: string; after: string } => {
  const aWords = a.match(/\S+/g) ?? [];
  const bWords = b.match(/\S+/g) ?? [];
  const dp = buildLcsTable(aWords, bWords);

  const aParts: string[] = [];
  const bParts: string[] = [];
  let i = aWords.length;
  let j = bWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aWords[i - 1] === bWords[j - 1]) {
      aParts.unshift(aWords[i - 1]);
      bParts.unshift(bWords[j - 1]);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      bParts.unshift(`**${bWords[j - 1]}**`);
      j--;
    } else {
      aParts.unshift(`**${aWords[i - 1]}**`);
      i--;
    }
  }

  return { before: aParts.join(' '), after: bParts.join(' ') };
};
