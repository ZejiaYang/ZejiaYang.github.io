# Blog authoring

The blog is intentionally empty until a real post is added. This README is authoring guidance only; it is not loaded as a post.

For long writing, add a `.md` file directly in this directory. Its filename, without `.md`, is the slug used for both `~/blog/<slug>.md` and `/blog/<slug>/`. Use letters, numbers, hyphens, or underscores, beginning with a letter or number. Hidden files and `README.md` are ignored.

Start the file with YAML frontmatter delimited by lines containing `---`. Supply all three fields:

- `title`: a nonempty string, used in the page title and blog listing.
- `date`: a valid `YYYY-MM-DD` string, used to sort posts newest first.
- `summary`: a nonempty string, used for the page description and Open Graph metadata.

An optional `tags` field may contain an array of strings. Quote strings containing YAML punctuation. Only YAML data is parsed; frontmatter is not executable.

Write the Markdown body after the closing `---`. It is displayed as Markdown source in the read-only editor, preserving headings, lists, quotations, and fenced code blocks using either backticks or tildes. Add a Markdown heading to the body if you want one visible in the editor; the page also includes a screen-reader heading from the frontmatter title. Raw HTML is shown as text, not executed.

The site reads files at build time and statically exports their canonical pages and JSON editor content. Adding or editing a post requires rebuilding and redeploying the site; there is no runtime server or browser-side filesystem access.

Existing typed `PostBlock` entries in `lib/posts.ts` remain supported. A slug must be unique across typed entries and Markdown files.

The installed Next.js static exporter rejects an empty `generateStaticParams()` array. While there are no posts, `/blog/[slug]` uses the reserved validation slug `__empty` and immediately returns `notFound()`. It has no post content, filesystem entry, listing, or sitemap entry. Do not use that slug for a real post. As soon as real posts exist, only their actual slugs are generated.
