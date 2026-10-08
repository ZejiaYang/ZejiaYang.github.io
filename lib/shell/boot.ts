// Boot sessions: the static scrollback every page starts with.
// Runs at build time in the server pages and is passed to the
// client terminal as props, so SSR and hydration match exactly.

import { buildFs, HOME } from "./fs";
import { runCommand, type CmdContext } from "./commands";
import { blank, text, type Line, type CmdLine, type OutLine } from "./lines";

function echo(cwd: string[], text: string): CmdLine {
  return { kind: "cmd", cwd, text };
}

/** Run a command against a throwaway context, for static sessions. */
function staticRun(cwd: string[], raw: string): { lines: Line[]; cwd: string[] } {
  const root = buildFs();
  const ctx: CmdContext = { cwd, prevCwd: null, root, history: [] };
  const result = runCommand(raw, ctx);
  const lines: Line[] = [echo(cwd, raw), ...(result.out ?? [])];
  return { lines, cwd: result.cwd ?? cwd };
}

function loginLine(now: Date): OutLine {
  const date = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = now.toTimeString().slice(0, 8);
  return text(`Last login: ${date} ${time} on ttys000`, "muted");
}

/** The banner as a single structured block line. */
const banner: Line = { kind: "block", block: "banner" };

/** The home session: login line, then straight to the banner. */
export function bootSession(now: Date): { lines: Line[]; cwd: string[] } {
  const lines: Line[] = [loginLine(now), blank(), banner];
  return { lines, cwd: [...HOME] };
}

/** Boot straight into a directory and list it (used by /projects, /blog). */
export function dirSession(
  dir: "project" | "blog" | "random",
  now: Date,
): { lines: Line[]; cwd: string[] } {
  const lines: Line[] = [loginLine(now), blank()];
  const cd = staticRun(HOME, `cd ${dir}`);
  lines.push(...cd.lines);
  const ls = staticRun(cd.cwd, "ls");
  lines.push(...ls.lines, blank(), banner);
  return { lines, cwd: cd.cwd };
}
