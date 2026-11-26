export function normalizeStoreName(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[0-9]/g, '')
    .replace(/[^a-z]/g, '')
    .trim();
}

export function storeSimilarity(a: string, b: string): number {
  const x = normalizeStoreName(a);
  const y = normalizeStoreName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.92;
  const grams = (value: string) => {
    const padded = `  ${value}  `;
    const set = new Set<string>();
    for (let i = 0; i < padded.length - 2; i += 1) set.add(padded.slice(i, i + 3));
    return set;
  };
  const gx = grams(x);
  const gy = grams(y);
  let intersect = 0;
  gx.forEach((g) => {
    if (gy.has(g)) intersect += 1;
  });
  return (2 * intersect) / (gx.size + gy.size);
}

export function isLikelySameStore(a: string, b: string): boolean {
  return storeSimilarity(a, b) >= 0.72;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function msToTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60).toString().padStart(2, '0');
  const seconds = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
