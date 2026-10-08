// ─────────────────────────────────────────────────────────────
//  Things you like: each category becomes a file at
//  ~/random/<slug>.md. Entries can carry an optional link.
// ─────────────────────────────────────────────────────────────

export type Like = {
  name: string;
  note?: string; // one short line, shown after the name
  href?: string;
};

export type LikeCategory = {
  slug: string; // the file name: /home/random/<slug>.md
  title: string;
  blurb?: string;
  items: Like[];
};

export const likes: LikeCategory[] = [
  // Empty for now. Add a category (books, music, uses, …) and it
  // becomes a file at ~/random/<slug>.md.
];
