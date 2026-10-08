import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { projects, type Project } from "./projects";
import { posts, blogEmptyNote, type Post } from "./posts";
import { likes } from "./likes";
import { site } from "./site";
import {
  aboutFile,
  nowFile,
  elsewhereFile,
  projectFile,
  postFile,
  markdownFile,
  likeFile,
} from "./shell/editor-lines";
import type { FsDir, FsFile } from "./shell/fs";

/** Typed PostBlock entries still work; Markdown posts carry their raw body. */
export type ContentPost = Post & { markdown?: string };
export type ContentFile = { path: string[]; file: FsFile };

const BLOG_DIRECTORY = join(process.cwd(), "content", "blog");

export function readMarkdownPosts(directory = BLOG_DIRECTORY): ContentPost[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.md$/i.test(entry.name) &&
        entry.name.toLowerCase() !== "readme.md" &&
        !entry.name.startsWith("."),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const slug = entry.name.slice(0, -3);
      if (!/^[a-z0-9][a-z0-9_-]*$/i.test(slug)) {
        throw new Error(
          `Invalid blog filename "${entry.name}": use a URL-safe slug starting with a letter or number.`,
        );
      }
      const source = readFileSync(join(directory, entry.name), "utf8");
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
      if (!frontmatter) {
        throw new Error(
          `Blog file "${entry.name}" must start with YAML frontmatter (title, date, summary).`,
        );
      }
      const data: unknown = parse(frontmatter[1]);
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error(
          `Blog file "${entry.name}" must have a frontmatter mapping.`,
        );
      }
      const fields = data as Record<string, unknown>;
      function requiredString(key: "title" | "date" | "summary"): string {
        const value = fields[key];
        if (typeof value !== "string" || !value.trim()) {
          throw new Error(
            `Blog file "${entry.name}" needs a nonempty ${key} string.`,
          );
        }
        return value;
      }
      const title = requiredString("title");
      const date = requiredString("date");
      const summary = requiredString("summary");
      const parsedDate = new Date(`${date}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== date
      ) {
        throw new Error(
          `Blog file "${entry.name}" needs a valid date in YYYY-MM-DD format.`,
        );
      }
      if (
        fields.tags !== undefined &&
        (!Array.isArray(fields.tags) ||
          !fields.tags.every((tag) => typeof tag === "string"))
      ) {
        throw new Error(
          `Blog file "${entry.name}" tags must be an array of strings.`,
        );
      }
      return {
        slug,
        title,
        date,
        summary,
        tags: fields.tags as string[] | undefined,
        blocks: [],
        markdown: source.slice(frontmatter[0].length),
      };
    });
}

/** Both content/blog/*.md and legacy typed entries, newest first. */
export function allPosts(): ContentPost[] {
  const combined: ContentPost[] = [...posts, ...readMarkdownPosts()];
  const slugs = new Set<string>();
  for (const post of combined) {
    if (post.slug === "__empty") {
      throw new Error(
        'Blog slug "__empty" is reserved for Next.js empty-route validation.',
      );
    }
    if (slugs.has(post.slug)) {
      throw new Error(
        `Duplicate blog slug "${post.slug}" in typed posts or content/blog.`,
      );
    }
    slugs.add(post.slug);
  }
  return combined.sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): ContentPost | undefined {
  return allPosts().find((post) => post.slug === slug);
}

export function allProjects(): Project[] {
  return [...projects];
}

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

/** Enumerate every file, including hidden files, by its absolute FS segments. */
export function contentFiles(root: FsDir): ContentFile[] {
  const result: ContentFile[] = [];
  function visit(dir: FsDir, path: string[]) {
    for (const child of dir.children) {
      const childPath = [...path, child.name];
      if (child.type === "dir") visit(child, childPath);
      else result.push({ path: childPath, file: child });
    }
  }
  visit(root, []);
  return result;
}

/** Build-time only: full file bodies are kept here, not in the client bundle. */
export function buildFs(): FsDir {
  const root: FsDir = {
    type: "dir",
    name: "",
    children: [
      {
        type: "dir",
        name: "home",
        children: [
          {
            type: "file",
            name: "about.txt",
            title: site.name,
            edLines: aboutFile(),
          },
          { type: "file", name: "now.txt", title: "now", edLines: nowFile() },
          {
            type: "file",
            name: "elsewhere.txt",
            title: "elsewhere",
            edLines: elsewhereFile(),
          },
          {
            type: "file",
            name: "cat.txt",
            edLines: [
              { spans: [{ text: " /\\_/\\" }] },
              { spans: [{ text: "( o.o )" }] },
              { spans: [{ text: " > ^ <" }] },
            ],
          },
          {
            type: "file",
            name: ".secret",
            hidden: true,
            edLines: [
              {
                spans: [
                  {
                    text: "you found the secret. there is no secret.",
                    tone: "muted",
                  },
                ],
              },
            ],
          },
          {
            type: "dir",
            name: "project",
            children: projects.map((project) => ({
              type: "file" as const,
              name: `${project.slug}.md`,
              title: project.title,
              canonicalUrl: `/projects/${encodeURIComponent(project.slug)}/`,
              edLines: projectFile(project),
              openHref: project.href?.[0],
            })),
          },
          {
            type: "dir",
            name: "blog",
            emptyNote: blogEmptyNote,
            children: allPosts().map((post) => ({
              type: "file" as const,
              name: `${post.slug}.md`,
              title: post.title,
              date: post.date,
              canonicalUrl: `/blog/${encodeURIComponent(post.slug)}/`,
              edLines:
                post.markdown !== undefined
                  ? markdownFile(post.markdown)
                  : postFile(post),
            })),
          },
          {
            type: "dir",
            name: "random",
            children: likes.map((category) => ({
              type: "file" as const,
              name: `${category.slug}.md`,
              title: category.title,
              edLines: likeFile(category),
            })),
          },
        ],
      },
    ],
  };
  for (const { path, file } of contentFiles(root)) {
    file.contentUrl = `/content/${path.map(encodeURIComponent).join("/")}.json`;
    file.size = file.edLines?.reduce(
      (total, line) =>
        total +
        line.spans.reduce((length, span) => length + span.text.length, 0),
      0,
    );
  }
  return root;
}
