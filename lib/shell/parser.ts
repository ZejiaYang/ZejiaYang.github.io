// Tiny shell parser: splits on whitespace, honoring single and
// double quotes (quotes are stripped). No escaping or expansion
// beyond that: it's a toy, not POSIX.

export function tokenize(raw: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}
