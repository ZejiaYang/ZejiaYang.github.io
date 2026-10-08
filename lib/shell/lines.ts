// Output model for the shell. Everything the terminal prints is a
// list of these lines, which keeps the shell logic UI-free.

export type Tone =
  | "fg"
  | "muted"
  | "blue"
  | "cyan"
  | "green"
  | "orange"
  | "red"
  | "purple";

export type Span = {
  text: string;
  tone?: Tone;
  bold?: boolean;
  /** Run this shell command when clicked. */
  cmd?: string;
  /** Open this URL in a new tab when clicked. */
  href?: string;
};

/** A line of command output. `tight` packs rows vertically (ASCII art). */
export type OutLine = { spans: Span[]; tight?: boolean };

/** An echoed command, rendered with the prompt it was typed at. */
export type CmdLine = { kind: "cmd"; cwd: string[]; text: string };

/** Rich blocks rendered by dedicated components. */
export type BlockKind = "banner" | "fastfetch";

/** A structured block rendered by a dedicated component. */
export type BlockLine = { kind: "block"; block: BlockKind };

export type Line = OutLine | CmdLine | BlockLine;

export function isCmdLine(line: Line): line is CmdLine {
  return "kind" in line && line.kind === "cmd";
}

export function isBlockLine(line: Line): line is BlockLine {
  return "kind" in line && line.kind === "block";
}

// Small constructors to keep command code readable.

export const out = (...spans: Span[]): OutLine => ({ spans });
export const blank = (): OutLine => ({ spans: [{ text: "" }] });
export const text = (t: string, tone?: Tone): OutLine => ({
  spans: [{ text: t, tone }],
});
export const errorText = (t: string): OutLine => ({
  spans: [{ text: t, tone: "red" }],
});
