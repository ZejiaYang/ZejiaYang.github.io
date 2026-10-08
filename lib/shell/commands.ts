// The command registry. Pure functions over the fake FS: the
// terminal UI interprets the results (printing, cd, opening the
// editor, opening URLs, switching themes).

import { site } from "@/lib/site";
import {
  resolve,
  displayPath,
  HOME,
  type FsDir,
  type FsFile,
  type FsNode,
} from "./fs";
import { calendarLines, dayOfYear } from "./calendar";
import { tokenize } from "./parser";
import {
  out,
  blank,
  text,
  errorText,
  type BlockKind,
  type OutLine,
  type Span,
  type Tone,
} from "./lines";

export type EditorTarget = { path: string[]; file: FsFile };

export type CmdResult = {
  out?: OutLine[];
  block?: BlockKind;
  cwd?: string[];
  clear?: boolean;
  editor?: EditorTarget;
  openUrl?: string;
  theme?: "dark" | "light" | "toggle";
};

export type CmdContext = {
  cwd: string[];
  prevCwd: string[] | null;
  root: FsDir;
  history: string[];
};

export const COMMAND_NAMES = [
  "whoami", "ls", "cd", "pwd", "cat", "vim", "open", "clear",
  "help", "theme", "echo", "history", "fastfetch", "exit",
  "skills", "mood", "cal", "date", "fortune", "htop",
];

const err = (t: string): CmdResult => ({ out: [errorText(t)] });

// ── individual commands ────────────────────────────────────────

function cmdWhoami(): CmdResult {
  return {
    out: [text(site.name.toLowerCase().split(" ")[0])],
  };
}

function cmdLs(args: string[], ctx: CmdContext): CmdResult {
  const flags = args.filter((a) => a.startsWith("-")).join("");
  const long = flags.includes("l");
  const all = flags.includes("a");
  const target = args.find((a) => !a.startsWith("-"));

  const hit = resolve(ctx.root, ctx.cwd, target);
  if (!hit) {
    return err(`ls: no such file or directory: ${target}`);
  }
  const { node, path } = hit;

  // ls on a file just prints the file.
  if (node.type === "file") {
    return { out: [out(entrySpan(node, path))] };
  }

  let children = node.children;
  if (!all) children = children.filter((c) => !(c.type === "file" && c.hidden));
  if (children.length === 0) {
    return { out: [text(node.emptyNote ?? "(nothing here yet)", "muted")] };
  }

  if (long) {
    return {
      out: children.map((child) => {
        const isDir = child.type === "dir";
        const spans: Span[] = [
          { text: isDir ? "drwxr-xr-x" : "-rw-r--r--", tone: "muted" },
          {
            text: `  ${String(sizeOf(child)).padStart(5)}  `,
            tone: "muted",
          },
          entrySpan(child, [...path, child.name]),
        ];
        return out(...spans);
      }),
    };
  }

  // Columnized-ish: names padded to the longest, wrapping naturally.
  const visible = children;
  const width = Math.max(...visible.map((c) => displayName(c).length)) + 2;
  const spans: Span[] = [];
  visible.forEach((child, i) => {
    const span = entrySpan(child, [...path, child.name]);
    span.text = span.text.padEnd(i === visible.length - 1 ? 0 : width);
    spans.push(span);
  });
  return { out: [out(...spans)] };
}

function displayName(node: FsNode): string {
  return node.type === "dir" ? `${node.name}/` : node.name;
}

function entrySpan(node: FsNode, path: string[]): Span {
  const isDir = node.type === "dir";
  const homeRelative =
    path[0] === "home" ? "~/" + path.slice(1).join("/") : displayPath(path);
  return {
    text: displayName(node),
    tone: isDir ? "blue" : "fg",
    bold: isDir,
    cmd: isDir ? `cd ${quote(homeRelative)}` : `vim ${quote(homeRelative)}`,
  };
}

function sizeOf(node: FsNode): number {
  if (node.type === "dir") return 96 + node.children.length * 32;
  return node.edLines.reduce((n, l) => n + l.spans.reduce((m, s) => m + s.text.length, 0), 0);
}

function cmdCd(args: string[], ctx: CmdContext): CmdResult {
  const target = args[0];
  if (!target || target === "~") return { cwd: [...HOME] };
  if (target === "-") {
    if (!ctx.prevCwd) return err("cd: OLDPWD not set");
    return { cwd: ctx.prevCwd, out: [text(displayPath(ctx.prevCwd), "muted")] };
  }
  const hit = resolve(ctx.root, ctx.cwd, target);
  if (!hit) return err(`cd: no such file or directory: ${target}`);
  if (hit.node.type !== "dir") return err(`cd: not a directory: ${target}`);
  return { cwd: hit.path };
}

function cmdPwd(ctx: CmdContext): CmdResult {
  return { out: [text(displayPath(ctx.cwd))] };
}

type ResolvedFile =
  | { ok: true; file: FsFile; path: string[] }
  | { ok: false; error: CmdResult };

function resolveFile(args: string[], ctx: CmdContext, cmd: string): ResolvedFile {
  const target = args.find((a) => !a.startsWith("-"));
  if (!target) return { ok: false, error: err(`${cmd}: missing file operand`) };
  const hit = resolve(ctx.root, ctx.cwd, target);
  if (!hit) {
    return { ok: false, error: err(`${cmd}: no such file or directory: ${target}`) };
  }
  if (hit.node.type !== "file") {
    return { ok: false, error: err(`${cmd}: ${target}: is a directory`) };
  }
  return { ok: true, file: hit.node, path: hit.path };
}

function cmdCat(args: string[], ctx: CmdContext): CmdResult {
  const hit = resolveFile(args, ctx, "cat");
  if (!hit.ok) return hit.error;
  return { out: hit.file.edLines };
}

function cmdVim(args: string[], ctx: CmdContext): CmdResult {
  if (args.length === 0) {
    return {
      out: [text("vim: no file given. nice try, you can't get trapped here", "orange")],
    };
  }
  const hit = resolveFile(args, ctx, "vim");
  if (!hit.ok) return hit.error;
  return { editor: { path: hit.path, file: hit.file } };
}

function cmdOpen(args: string[], ctx: CmdContext): CmdResult {
  const target = args[0];
  if (!target) return err("open: missing operand (a project file, e.g. project-alpha.md)");
  // Accept a bare slug too: "open project-alpha".
  const withExt = target.endsWith(".md") ? target : `${target}.md`;
  const hit =
    resolve(ctx.root, ctx.cwd, target) ?? resolve(ctx.root, ctx.cwd, withExt);
  if (!hit || hit.node.type !== "file") {
    return err(`open: no such file: ${target}`);
  }
  if (!hit.node.openHref) {
    return err(`open: ${target} has no link associated with it`);
  }
  return {
    openUrl: hit.node.openHref,
    out: [text(`opening ${hit.node.openHref} …`, "muted")],
  };
}

function cmdTheme(args: string[]): CmdResult {
  const arg = args[0];
  if (arg === "dark" || arg === "light") {
    return { theme: arg, out: [text(`theme set to ${arg}`, "muted")] };
  }
  if (!arg) return { theme: "toggle" };
  return err(`theme: unknown theme: ${arg} (try "theme dark" or "theme light")`);
}

function cmdHelp(): CmdResult {
  const rows: [string, string][] = [
    ["ls ./project", "things i've built"],
    ["ls ./blog", "writing"],
    ["ls ./random", "things i'm into"],
    ["cat <file>", "print a file right here"],
    ["vim <file>", "open a file in the editor (q to quit)"],
    ["open <file>", "open a project's link in a new tab"],
    ["cd <dir>", "move around (cd ~, cd .., cd -)"],
    ["pwd / whoami", "the classics"],
    ["theme [dark|light]", "switch palette"],
    ["skills · mood", "meters, technical and emotional"],
    ["cal · date · fortune", "the month, the moment, a thought"],
    ["clear", "wipe the scrollback (or ctrl+l)"],
    ["fastfetch", "obligatory"],
  ];
  const width = Math.max(...rows.map(([c]) => c.length)) + 2;
  return {
    out: [
      text("available commands:", "muted"),
      ...rows.map(([cmd, desc]) =>
        out(
          { text: "  " + cmd.padEnd(width), tone: "cyan", cmd },
          { text: `# ${desc}`, tone: "green" },
        ),
      ),
      blank(),
      text("tip: most paths and commands in the output are clickable", "muted"),
    ],
  };
}

function cmdFastfetch(): CmdResult {
  // Rendered by the Fastfetch component as a real layout (see
  // components/terminal/fastfetch.tsx), not padded text.
  return { block: "fastfetch" };
}

function cmdSkills(): CmdResult {
  const width = Math.max(...site.skills.map((s) => s.label.length));
  return {
    out: site.skills.map((skill) => {
      const pct = Math.round(skill.max * 100);
      const filled = Math.round(pct / 10);
      return out(
        { text: skill.label.padEnd(width + 2) },
        { text: "█".repeat(filled), tone: "green" },
        { text: "░".repeat(10 - filled), tone: "muted" },
        { text: ` ${pct}%`, tone: "muted" },
      );
    }),
  };
}

const MOOD_TONES: Tone[] = ["blue", "orange", "purple"];

function cmdMood(): CmdResult {
  const width = Math.max(...site.mood.map((m) => m.label.length));
  return {
    out: site.mood.map((meter, i) => {
      const pct = Math.round(meter.max * 100);
      const filled = Math.round(pct / 10);
      return out(
        { text: meter.label.padEnd(width + 2) },
        { text: "█".repeat(filled), tone: MOOD_TONES[i % MOOD_TONES.length] },
        { text: "░".repeat(10 - filled), tone: "muted" },
        { text: ` ${pct}%`, tone: "muted" },
      );
    }),
  };
}

function cmdCal(): CmdResult {
  return { out: calendarLines(new Date()) };
}

function cmdDate(): CmdResult {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return { out: [text(`${day}  ${now.toTimeString().slice(0, 8)}`)] };
}

function cmdFortune(): CmdResult {
  const fortune =
    site.fortunes[dayOfYear(new Date()) % site.fortunes.length];
  return { out: [text(`"${fortune}"`)] };
}

// ── dispatch ───────────────────────────────────────────────────

export function runCommand(raw: string, ctx: CmdContext): CmdResult {
  const tokens = tokenize(raw);
  if (tokens.length === 0) return {};
  const [cmd, ...args] = tokens;

  switch (cmd) {
    case "whoami": return cmdWhoami();
    case "ls": return cmdLs(args, ctx);
    case "ll": return cmdLs(["-l", ...args], ctx);
    case "cd": return cmdCd(args, ctx);
    case "pwd": return cmdPwd(ctx);
    case "cat": return cmdCat(args, ctx);
    case "vim":
    case "vi":
    case "nvim": return cmdVim(args, ctx);
    case "open": return cmdOpen(args, ctx);
    case "clear": return { clear: true };
    case "help": return cmdHelp();
    case "theme": return cmdTheme(args);
    case "echo": return { out: [text(args.join(" "))] };
    case "history":
      return {
        out: ctx.history.map((h, i) =>
          out({ text: `  ${String(i + 1).padStart(4)}  `, tone: "muted" }, { text: h }),
        ),
      };
    case "fastfetch": return cmdFastfetch();
    case "neofetch":
      return {
        out: [text("note: neofetch is unmaintained, so here's fastfetch instead", "muted")],
        block: "fastfetch",
      };
    case "skills": return cmdSkills();
    case "mood": return cmdMood();
    case "cal": return cmdCal();
    case "date": return cmdDate();
    case "fortune": return cmdFortune();
    case "htop":
      return { out: [text("htop: too heavy for this shell, watch the dashboard pane →", "orange")] };
    case "sudo":
      return err(`${site.shell.user} is not in the sudoers file. this incident will be reported.`);
    case "rm":
      return err("rm: refusing. everything here is read-only.");
    case "emacs":
      return { out: [text("emacs: command not found (this is a vim household)", "orange")] };
    case "nano":
      return { out: [text("nano: command not found (this is a vim household)", "orange")] };
    case "exit":
    case "logout":
      return { out: [text("there is no escape. (this is a website.)", "orange")] };
    default:
      return {
        out: [
          errorText(`zsh: command not found: ${cmd}`),
          text("type `help` to see what's available", "muted"),
        ],
      };
  }
}

function quote(path: string): string {
  return path.includes(" ") ? `"${path}"` : path;
}
