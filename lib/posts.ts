// ─────────────────────────────────────────────────────────────
//  Blog posts: each post becomes a page at /blog/<slug>/.
//  The body is a list of content blocks (see PostBlock below),
//  so you can write posts without touching any markup.
// ─────────────────────────────────────────────────────────────

export type PostBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string; lang?: string };

export type Post = {
  slug: string; // the URL: /blog/<slug>/
  title: string;
  date: string; // "YYYY-MM-DD"
  summary: string; // shown in the post list
  tags?: string[];
  blocks: PostBlock[];
};

export const posts: Post[] = [
  // No posts yet. The first real one goes here: see PostBlock
  // above for the available content block types.
];

// Shown when ~/blog is empty, in the shell and the dashboard pane.
export const blogEmptyNote =
  "nothing here yet. i'll try to update weekly with good blogs / technical posts i read elsewhere. just started, hope i have the motivation to keep going.";

/** Newest first. */
export function allPosts(): Post[] {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}

/** "2026-09-28" → "Sep 28, 2026" (parsed as local time to avoid TZ shifts). */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
