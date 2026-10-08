import { COMMAND_NAMES, type CmdResult, type EditorTarget } from "./commands";
import { HOME, resolve, type FsDir } from "./fs";
import type { Line } from "./lines";

export type ShellState = {
  lines: Line[];
  cwd: string[];
  prevCwd: string[] | null;
  history: string[];
  editor: EditorTarget | null;
};

export type ShellAction =
  | { type: "command"; raw: string; result: CmdResult }
  | { type: "clear" }
  | { type: "echo"; line: Line }
  | { type: "restore"; cwd: string[]; editor: EditorTarget | null }
  | { type: "quit" };

const MAX_LINES = 1000;
const MAX_HISTORY = 200;

export function shellReducer(
  state: ShellState,
  action: ShellAction,
): ShellState {
  if (action.type === "clear") return { ...state, lines: [], history: [] };
  if (action.type === "quit") return { ...state, editor: null };
  if (action.type === "restore")
    return { ...state, cwd: action.cwd, editor: action.editor };
  if (action.type === "echo")
    return { ...state, lines: [...state.lines, action.line].slice(-MAX_LINES) };
  const { raw, result } = action;
  const command = raw.trim();
  const history =
    command && state.history.at(-1) !== command
      ? [...state.history, command].slice(-MAX_HISTORY)
      : state.history;
  const output: Line[] = [
    { kind: "cmd", cwd: state.cwd, text: raw },
    ...(result.out ?? []),
  ];
  if (result.block) output.push({ kind: "block", block: result.block });
  return {
    lines: result.clear ? [] : [...state.lines, ...output].slice(-MAX_LINES),
    cwd: result.cwd ?? state.cwd,
    prevCwd:
      result.cwd && result.cwd.join("/") !== state.cwd.join("/")
        ? state.cwd
        : state.prevCwd,
    editor: result.editor ?? null,
    history: result.clear ? [] : history,
  };
}

function longestPrefix(values: string[]): string {
  let prefix = values[0] ?? "";
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

export function completeBuffer(
  buf: string,
  cwd: string[],
  root: FsDir,
): { next: string; matches: string[] } {
  const tokens = buf.trimStart().split(/\s+/);
  if (tokens.length === 1 && !/\s$/.test(buf)) {
    const matches = COMMAND_NAMES.filter((name) => name.startsWith(buf.trim()));
    const prefix = longestPrefix(matches);
    return {
      next:
        matches.length === 1
          ? `${matches[0]} `
          : prefix.length > buf.trim().length
            ? prefix
            : buf,
      matches,
    };
  }
  const token = /\s$/.test(buf) ? "" : (tokens.at(-1) ?? "");
  const head = buf.slice(0, buf.length - token.length);
  const slash = token.lastIndexOf("/");
  const directory = slash >= 0 ? token.slice(0, slash + 1) : "";
  const prefix = slash >= 0 ? token.slice(slash + 1) : token;
  const hit = resolve(root, cwd, directory || ".");
  if (!hit || hit.node.type !== "dir") return { next: buf, matches: [] };
  const command = tokens[0];
  const matches = hit.node.children
    .filter(
      (node) =>
        !(node.type === "file" && node.hidden && !prefix.startsWith(".")),
    )
    .filter((node) => command !== "cd" || node.type === "dir")
    .map((node) => node.name + (node.type === "dir" ? "/" : ""))
    .filter((name) => name.startsWith(prefix));
  if (matches.length === 1)
    return {
      next:
        head + directory + matches[0] + (matches[0].endsWith("/") ? "" : " "),
      matches,
    };
  const common = longestPrefix(matches);
  return {
    next: common.length > prefix.length ? head + directory + common : buf,
    matches,
  };
}

export function locationHash(
  state: ShellState,
  initialCwd: string[],
  initialEditor: EditorTarget | null = null,
): string {
  const sameCwd = state.cwd.join("/") === initialCwd.join("/");
  if (sameCwd && state.editor?.path.join("/") === initialEditor?.path.join("/"))
    return "";
  if (state.editor)
    return `#vim:${state.editor.path.slice(1).map(encodeURIComponent).join("/")}`;
  if (state.cwd[0] === "home" && state.cwd.length > 1)
    return `#~/${state.cwd.slice(1).map(encodeURIComponent).join("/")}`;
  return `#cwd:${encodeURIComponent("/" + state.cwd.join("/"))}`;
}

export function commandFromHash(hash: string): string | null {
  if (hash.startsWith("#run:")) return decodeURIComponent(hash.slice(5));
  if (hash.startsWith("#vim:"))
    return `vim ${JSON.stringify(`~/${decodeURIComponent(hash.slice(5))}`)}`;
  if (hash.startsWith("#~/"))
    return `cd ${JSON.stringify(`~/${decodeURIComponent(hash.slice(3))}`)}`;
  if (hash.startsWith("#cwd:"))
    return `cd ${JSON.stringify(decodeURIComponent(hash.slice(5)))}`;
  return null;
}

export function homeContext(root: FsDir) {
  return { root, cwd: [...HOME], prevCwd: null, history: [] };
}
