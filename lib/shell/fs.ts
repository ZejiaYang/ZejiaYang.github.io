// The fake filesystem. Rooted at / with a single /home directory
// containing about.txt and the project/, blog/, random/ folders.
// Pure data: built from the content files in lib/.

import { projects } from "@/lib/projects";
import { posts, blogEmptyNote } from "@/lib/posts";
import { likes } from "@/lib/likes";
import {
  aboutFile,
  nowFile,
  elsewhereFile,
  projectFile,
  postFile,
  likeFile,
} from "./editor-lines";
import type { OutLine } from "./lines";

export type FsFile = {
  type: "file";
  name: string;
  edLines: OutLine[];
  openHref?: string;
  hidden?: boolean;
};

export type FsDir = {
  type: "dir";
  name: string;
  children: FsNode[];
  /** Shown instead of an empty listing. */
  emptyNote?: string;
};

export type FsNode = FsFile | FsDir;

export const HOME = ["home"];

// Names from the original brief, kept working as silent aliases.
const ALIASES: Record<string, string> = {
  "things-i-made": "project",
  "things-i-like": "random",
};

export function buildFs(): FsDir {
  return {
    type: "dir",
    name: "",
    children: [
      {
        type: "dir",
        name: "home",
        children: [
          { type: "file", name: "about.txt", edLines: aboutFile() },
          { type: "file", name: "now.txt", edLines: nowFile() },
          { type: "file", name: "elsewhere.txt", edLines: elsewhereFile() },
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
              { spans: [{ text: "you found the secret. there is no secret.", tone: "muted" }] },
            ],
          },
          {
            type: "dir",
            name: "project",
            children: projects.map((p) => ({
              type: "file" as const,
              name: `${p.slug}.md`,
              edLines: projectFile(p),
              openHref: p.href,
            })),
          },
          {
            type: "dir",
            name: "blog",
            emptyNote: blogEmptyNote,
            children: posts.map((p) => ({
              type: "file" as const,
              name: `${p.slug}.md`,
              edLines: postFile(p),
              openHref: undefined,
            })),
          },
          {
            type: "dir",
            name: "random",
            children: likes.map((c) => ({
              type: "file" as const,
              name: `${c.slug}.md`,
              edLines: likeFile(c),
            })),
          },
        ],
      },
    ],
  };
}

/** Split a path string into segments, expanding a leading ~. */
export function splitPath(path: string): { absolute: boolean; segments: string[] } {
  let p = path.trim();
  let absolute = false;
  if (p.startsWith("~")) {
    p = "/home" + p.slice(1);
  }
  if (p.startsWith("/")) {
    absolute = true;
  }
  const segments = p.split("/").filter((s) => s.length > 0 && s !== ".");
  return { absolute, segments };
}

/**
 * Resolve `path` against `cwd`. Returns the node and its absolute
 * path segments, or null if it doesn't exist.
 */
export function resolve(
  root: FsDir,
  cwd: string[],
  path?: string,
): { node: FsNode; path: string[] } | null {
  if (!path || path === ".") {
    return { node: nodeAt(root, cwd)!, path: cwd };
  }
  const { absolute, segments } = splitPath(path);
  const stack = absolute ? [] : [...cwd];
  for (let seg of segments) {
    if (seg === "..") {
      stack.pop();
      continue;
    }
    // Aliases only apply inside /home.
    if (stack.length === 1 && stack[0] === "home" && ALIASES[seg]) {
      seg = ALIASES[seg];
    }
    const node = nodeAt(root, [...stack, seg]);
    if (!node) return null;
    stack.push(seg);
  }
  return { node: nodeAt(root, stack)!, path: stack };
}

export function nodeAt(root: FsDir, path: string[]): FsNode | null {
  let node: FsNode = root;
  for (const seg of path) {
    if (node.type !== "dir") return null;
    const child: FsNode | undefined = node.children.find((c) => c.name === seg);
    if (!child) return null;
    node = child;
  }
  return node;
}

/** "~/project" style, for the prompt and title bar. */
export function formatCwd(cwd: string[]): string {
  if (cwd.length === 0) return "/";
  if (cwd[0] === "home") {
    const rest = cwd.slice(1);
    return "~" + (rest.length ? "/" + rest.join("/") : "");
  }
  return "/" + cwd.join("/");
}

/** "/home/project" style, for messages. */
export function displayPath(path: string[]): string {
  return "/" + path.join("/");
}
