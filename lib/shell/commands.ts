import { site } from "@/lib/site";
import type { MeterSnapshot } from "@/lib/telemetry";
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
export type FileRead = EditorTarget & { mode: "cat" | "vim" };

export type CmdResult = {
  out?: OutLine[];
  block?: BlockKind;
  cwd?: string[];
  clear?: boolean;
  editor?: EditorTarget;
  read?: FileRead;
  openUrl?: string;
  theme?: "dark" | "light" | "toggle";
};

export type CmdContext = {
  cwd: string[];
  prevCwd: string[] | null;
  root: FsDir;
  history: string[];
  meters?: MeterSnapshot;
};

export type Shortcut = {
  id: string;
  command: string;
  description: string;
  quick?: boolean;
};

type Command = {
  name: string;
  aliases?: string[];
  usage: string;
  description: string;
  examples?: Shortcut[];
  hidden?: boolean;
  run: (args: string[], ctx: CmdContext) => CmdResult;
};

const err = (message: string): CmdResult => ({ out: [errorText(message)] });

function cmdLs(args: string[], ctx: CmdContext): CmdResult {
  const flags = args.filter((arg) => arg.startsWith("-")).join("");
  const target = args.find((arg) => !arg.startsWith("-"));
  const hit = resolve(ctx.root, ctx.cwd, target);
  if (!hit) return err(`ls: no such file or directory: ${target}`);
  const { node, path } = hit;
  if (node.type === "file") return { out: [out(entrySpan(node, path))] };
  const children = node.children.filter(
    (child) => flags.includes("a") || !(child.type === "file" && child.hidden),
  );
  if (!children.length)
    return { out: [text(node.emptyNote ?? "(nothing here yet)", "muted")] };
  if (flags.includes("l")) {
    return {
      out: children.map((child) =>
        out(
          {
            text: child.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--",
            tone: "muted",
          },
          { text: `  ${String(sizeOf(child)).padStart(5)}  `, tone: "muted" },
          entrySpan(child, [...path, child.name]),
        ),
      ),
    };
  }
  const width =
    Math.max(...children.map((child) => displayName(child).length)) + 2;
  return {
    out: [
      out(
        ...children.map((child, index) => {
          const span = entrySpan(child, [...path, child.name]);
          return {
            ...span,
            text:
              index === children.length - 1
                ? span.text
                : span.text.padEnd(width),
          };
        }),
      ),
    ],
  };
}

function displayName(node: FsNode): string {
  return node.name + (node.type === "dir" ? "/" : "");
}

function entrySpan(node: FsNode, path: string[]): Span {
  const target =
    path[0] === "home" ? `~/${path.slice(1).join("/")}` : displayPath(path);
  return {
    text: displayName(node),
    tone: node.type === "dir" ? "blue" : "fg",
    bold: node.type === "dir",
    cmd: `${node.type === "dir" ? "cd" : "vim"} ${quote(target)}`,
    href: node.type === "file" ? node.canonicalUrl : undefined,
  };
}

function sizeOf(node: FsNode): number {
  if (node.type === "dir") return 96 + node.children.length * 32;
  return (
    node.size ??
    node.edLines?.reduce(
      (sum, line) =>
        sum + line.spans.reduce((n, span) => n + span.text.length, 0),
      0,
    ) ??
    0
  );
}

function cmdCd(args: string[], ctx: CmdContext): CmdResult {
  const target = args[0];
  if (!target || target === "~") return { cwd: [...HOME] };
  if (target === "-") {
    return ctx.prevCwd
      ? { cwd: ctx.prevCwd, out: [text(displayPath(ctx.prevCwd), "muted")] }
      : err("cd: OLDPWD not set");
  }
  const hit = resolve(ctx.root, ctx.cwd, target);
  if (!hit) return err(`cd: no such file or directory: ${target}`);
  if (hit.node.type !== "dir") return err(`cd: not a directory: ${target}`);
  return { cwd: hit.path };
}

function readFile(
  args: string[],
  ctx: CmdContext,
  mode: "cat" | "vim",
): CmdResult {
  const target = args[0];
  if (!target) return err(`${mode}: missing file operand`);
  const hit = resolve(ctx.root, ctx.cwd, target);
  if (!hit) return err(`${mode}: no such file or directory: ${target}`);
  if (hit.node.type !== "file")
    return err(`${mode}: ${target}: is a directory`);
  if (!hit.node.edLines)
    return { read: { path: hit.path, file: hit.node, mode } };
  return mode === "cat"
    ? { out: hit.node.edLines }
    : { editor: { path: hit.path, file: hit.node } };
}

function cmdOpen(args: string[], ctx: CmdContext): CmdResult {
  const target = args[0];
  if (!target)
    return err("open: missing operand (try open ~/project/geospatial-mae.md)");
  const hit =
    resolve(ctx.root, ctx.cwd, target) ??
    resolve(ctx.root, ctx.cwd, `${target}.md`);
  if (!hit || hit.node.type !== "file")
    return err(`open: no such file: ${target}`);
  if (!hit.node.openHref)
    return err(`open: ${target} has no link associated with it`);
  return {
    openUrl: hit.node.openHref,
    out: [text(`opening ${hit.node.openHref} …`, "muted")],
  };
}

function cmdTheme(args: string[]): CmdResult {
  if (!args.length) return { theme: "toggle" };
  if (args[0] === "dark" || args[0] === "light") {
    return { theme: args[0], out: [text(`theme set to ${args[0]}`, "muted")] };
  }
  return err(
    `theme: unknown theme: ${args[0]} (try "theme dark" or "theme light")`,
  );
}

function meterLines(
  meters: { label: string; max: number }[],
  tones: Tone | Partial<Record<string, Tone>>,
  snapshot?: Record<string, number>,
): OutLine[] {
  const width = Math.max(0, ...meters.map((meter) => meter.label.length));
  return meters.map((meter) => {
    const pct = Math.max(
      0,
      Math.min(100, Math.round(snapshot?.[meter.label] ?? meter.max * 100)),
    );
    const filled = Math.round(pct / 10);
    return out(
      { text: meter.label.padEnd(width + 2) },
      {
        text: "█".repeat(filled),
        tone:
          typeof tones === "string" ? tones : (tones[meter.label] ?? "blue"),
      },
      { text: "░".repeat(10 - filled), tone: "muted" },
      { text: ` ${pct}%`, tone: "muted" },
    );
  });
}

function cmdHelp(): CmdResult {
  const visible = COMMANDS.filter((command) => !command.hidden);
  const width = Math.max(...visible.map((command) => command.usage.length)) + 2;
  return {
    out: [
      text("available commands:", "muted"),
      ...visible.flatMap((command) => [
        out(
          { text: `  ${command.usage.padEnd(width)}`, tone: "cyan" },
          { text: `# ${command.description}`, tone: "green" },
        ),
        ...(command.examples ?? []).map((example) =>
          out(
            { text: "    try: ", tone: "muted" },
            { text: example.command, tone: "cyan", cmd: example.command },
          ),
        ),
      ]),
      blank(),
      text("click an example to run it. Shift+Tab leaves the prompt.", "muted"),
    ],
  };
}

const COMMANDS: Command[] = [
  {
    name: "ls",
    aliases: ["ll"],
    usage: "ls [path] [-la]",
    description: "list files and folders",
    examples: [
      {
        id: "projects",
        command: "ls ~/project",
        description: "projects and papers",
        quick: true,
      },
      {
        id: "blog",
        command: "ls ~/blog",
        description: "reading notes",
        quick: true,
      },
      {
        id: "random",
        command: "ls ~/random",
        description: "other things",
        quick: true,
      },
    ],
    run: cmdLs,
  },
  {
    name: "cd",
    usage: "cd [dir]",
    description: "move around; ~, .. and - work",
    examples: [{ id: "home", command: "cd ~", description: "back home" }],
    run: cmdCd,
  },
  {
    name: "pwd",
    usage: "pwd",
    description: "where you are",
    run: (_, ctx) => ({ out: [text(displayPath(ctx.cwd))] }),
  },
  {
    name: "whoami",
    usage: "whoami",
    description: "the classic",
    run: () => ({ out: [text(site.name.toLowerCase().split(" ")[0])] }),
  },
  {
    name: "cat",
    usage: "cat <file>",
    description: "print a file",
    examples: [
      { id: "now", command: "cat ~/now.txt", description: "what i'm up to" },
      { id: "elsewhere", command: "cat ~/elsewhere.txt", description: "links" },
    ],
    run: (args, ctx) => readFile(args, ctx, "cat"),
  },
  {
    name: "vim",
    aliases: ["vi", "nvim"],
    usage: "vim <file>",
    description: "read a file; q quits",
    examples: [
      {
        id: "about",
        command: "vim ~/about.txt",
        description: "about me",
        quick: true,
      },
    ],
    run: (args, ctx) => readFile(args, ctx, "vim"),
  },
  {
    name: "open",
    usage: "open <file>",
    description: "open its primary link in a new tab",
    examples: [
      {
        id: "source",
        command: "open ~/project/geospatial-mae.md",
        description: "project source",
      },
    ],
    run: cmdOpen,
  },
  {
    name: "help",
    usage: "help",
    description: "this list",
    examples: [
      {
        id: "help",
        command: "help",
        description: "more commands",
        quick: true,
      },
    ],
    run: cmdHelp,
  },
  {
    name: "theme",
    usage: "theme [dark|light]",
    description: "toggle or choose a theme",
    examples: [{ id: "theme", command: "theme", description: "toggle theme" }],
    run: cmdTheme,
  },
  {
    name: "skills",
    usage: "skills [--usage]",
    description: "CV skills, or --usage for a live battery snapshot",
    examples: [
      {
        id: "skills",
        command: "skills --usage",
        description: "language batteries",
      },
    ],
    run: (args, ctx) => {
      if (!args.length)
        return {
          out: site.skillInventory.flatMap((group) => [
            out({ text: `${group.label}:`, tone: "blue", bold: true }),
            text(group.items.join(", ")),
            blank(),
          ]),
        };
      if (args.length !== 1 || args[0] !== "--usage")
        return err("skills: try skills or skills --usage");
      return { out: meterLines(site.skills, "green", ctx.meters?.skills) };
    },
  },
  {
    name: "mood",
    usage: "mood",
    description: "emotional telemetry",
    examples: [
      { id: "mood", command: "mood", description: "emotional telemetry" },
    ],
    run: (_, ctx) => ({
      out: meterLines(
        site.mood,
        { energy: "blue", caffeine: "orange", vibe: "purple" },
        ctx.meters?.mood,
      ),
    }),
  },
  {
    name: "date",
    usage: "date",
    description: "the moment",
    examples: [{ id: "date", command: "date", description: "the moment" }],
    run: () => ({ out: [text(new Date().toLocaleString("en-GB"))] }),
  },
  {
    name: "fortune",
    usage: "fortune",
    description: "a thought for today",
    examples: [
      { id: "fortune", command: "fortune", description: "a thought for today" },
    ],
    run: () => ({
      out: [
        text(
          site.fortunes.length
            ? `"${site.fortunes[dayOfYear(new Date()) % site.fortunes.length]}"`
            : "no fortune today",
        ),
      ],
    }),
  },
  {
    name: "cal",
    usage: "cal",
    description: "this month",
    run: () => ({ out: calendarLines(new Date()) }),
  },
  {
    name: "clear",
    usage: "clear",
    description: "clear output and command history; Ctrl+L also works",
    run: () => ({ clear: true }),
  },
  {
    name: "history",
    usage: "history",
    description: "commands from this session",
    run: (_, ctx) => ({
      out: ctx.history.map((command, index) =>
        out(
          { text: `${String(index + 1).padStart(4)}  `, tone: "muted" },
          { text: command },
        ),
      ),
    }),
  },
  {
    name: "echo",
    usage: "echo [text]",
    description: "repeat after you",
    run: (args) => ({ out: [text(args.join(" "))] }),
  },
  {
    name: "fastfetch",
    aliases: ["neofetch"],
    usage: "fastfetch",
    description: "obligatory",
    examples: [
      { id: "fastfetch", command: "fastfetch", description: "site facts" },
    ],
    run: () => ({ block: "fastfetch" }),
  },
  {
    name: "htop",
    usage: "htop",
    description: "not quite",
    hidden: true,
    run: () => ({
      out: [
        text(
          "htop: too heavy for this shell, watch the dashboard pane →",
          "orange",
        ),
      ],
    }),
  },
  {
    name: "sudo",
    usage: "sudo",
    description: "nope",
    hidden: true,
    run: () =>
      err(
        `${site.shell.user} is not in the sudoers file. this incident will be reported.`,
      ),
  },
  {
    name: "rm",
    usage: "rm",
    description: "read-only",
    hidden: true,
    run: () => err("rm: refusing. everything here is read-only."),
  },
  {
    name: "emacs",
    aliases: ["nano"],
    usage: "emacs",
    description: "wrong house",
    hidden: true,
    run: () => ({
      out: [text("command not found (this is a vim household)", "orange")],
    }),
  },
  {
    name: "exit",
    aliases: ["logout"],
    usage: "exit",
    description: "there is no escape",
    run: () => ({
      out: [text("there is no escape. (this is a website.)", "orange")],
    }),
  },
];

export const COMMAND_NAMES = COMMANDS.filter(
  (command) => !command.hidden,
).flatMap((command) => [command.name, ...(command.aliases ?? [])]);

export function getQuickCommands(): Shortcut[] {
  return COMMANDS.flatMap((command) => command.examples ?? []).filter(
    (example) => example.quick,
  );
}

export function getShortcut(id: string): Shortcut {
  const example = COMMANDS.flatMap((command) => command.examples ?? []).find(
    (shortcut) => shortcut.id === id,
  );
  if (!example) throw new Error(`Unknown command shortcut: ${id}`);
  return example;
}

export function runCommand(raw: string, ctx: CmdContext): CmdResult {
  const [name, ...args] = tokenize(raw);
  if (!name) return {};
  const command = COMMANDS.find(
    (entry) => entry.name === name || entry.aliases?.includes(name),
  );
  if (!command)
    return {
      out: [
        errorText(`zsh: command not found: ${name}`),
        text("type `help` to see what's available", "muted"),
      ],
    };
  return command.run(name === "ll" ? ["-l", ...args] : args, ctx);
}

function quote(path: string): string {
  return path.includes(" ") ? `"${path}"` : path;
}
