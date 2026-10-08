import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readMarkdownPosts } from "../../lib/content";
import { markdownFile } from "../../lib/shell/editor-lines";

mkdirSync(".next", { recursive: true });
const fixtures = mkdtempSync(join(process.cwd(), ".next", "content-tests-"));
after(() => rmSync(fixtures, { recursive: true, force: true }));

function directory(name: string) {
  const path = join(fixtures, name);
  mkdirSync(path);
  return path;
}

test("Markdown loading ignores authoring guides and hidden drafts", () => {
  const path = directory("valid");
  writeFileSync(join(path, "README.md"), "Instructions, not a post.");
  writeFileSync(join(path, ".draft.md"), "Not published.");
  writeFileSync(
    join(path, "reading-notes.md"),
    '---\ntitle: Reading notes\ndate: "2026-10-08"\nsummary: A few links.\ntags: [reading]\n---\n# Notes\n\n```ts\nconst x = 1;\n```\n',
  );
  const posts = readMarkdownPosts(path);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].slug, "reading-notes");
  assert.deepEqual(posts[0].tags, ["reading"]);
  assert.match(posts[0].markdown!, /const x = 1/);
});

test("Markdown metadata validation rejects invalid dates and shapes", () => {
  const path = directory("invalid");
  const file = join(path, "bad-date.md");
  writeFileSync(
    file,
    '---\ntitle: Notes\ndate: "2026-02-30"\nsummary: A sentence.\n---\nBody',
  );
  assert.throws(() => readMarkdownPosts(path), /valid date/);
  writeFileSync(
    file,
    '---\ntitle: Notes\ndate: "2026-02-28"\nsummary: A sentence.\ntags: not-a-list\n---\nBody',
  );
  assert.throws(() => readMarkdownPosts(path), /array of strings/);
});

test("source formatting preserves code fences and displays raw HTML as text", () => {
  const source =
    '# Notes\n\n```ts\nconst code = "' +
    "x".repeat(100) +
    '";\n```\n<script>alert(1)</script>';
  const lines = markdownFile(source);
  assert.equal(
    lines
      .map((line) => line.spans.map((span) => span.text).join(""))
      .join("\n"),
    source,
  );
  assert.ok(
    lines.every((line) =>
      line.spans.every((span) => !span.href?.startsWith("javascript:")),
    ),
  );
});
