// Pure definitions and path helpers for the shell's fake filesystem.
// Content is built on the server in lib/content.ts, never in client code.

import type { OutLine } from "./lines";

export type FsFile = {
  type: "file";
  name: string;
  /** Present on the server or after the client loads this file. */
  edLines?: OutLine[];
  /** Root-relative JSON endpoint; the client applies the deployment basePath. */
  contentUrl?: string;
  /** Root-relative static page for a project or blog post. */
  canonicalUrl?: string;
  title?: string;
  date?: string;
  size?: number;
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

/** Copy the tree without file bodies, preserving URLs and listing metadata. */
export function stripContent(root: FsDir): FsDir {
  function strip(node: FsNode, path: string[]): FsNode {
    if (node.type === "dir") {
      return {
        ...node,
        children: node.children.map((child) =>
          strip(child, [...path, child.name]),
        ),
      };
    }
    const { edLines, ...metadata } = node;
    return {
      ...metadata,
      contentUrl:
        node.contentUrl ??
        `/content/${path.map(encodeURIComponent).join("/")}.json`,
      size:
        node.size ??
        edLines?.reduce(
          (total, line) =>
            total +
            line.spans.reduce((length, span) => length + span.text.length, 0),
          0,
        ),
    };
  }

  return strip(root, []) as FsDir;
}

/** Split a path string into segments, expanding a leading ~. */
export function splitPath(path: string): {
  absolute: boolean;
  segments: string[];
} {
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
    const node = nodeAt(root, cwd);
    return node ? { node, path: cwd } : null;
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
  const node = nodeAt(root, stack);
  return node ? { node, path: stack } : null;
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
