// Pixel art for the banner. Each frame is a list of rows; each row
// is a list of colored segments. Rows in a frame must all be the
// same display width so the frames overlap exactly.

import type { Tone } from "./lines";

export type ArtSegment = { text: string; tone?: Tone };
export type ArtFrame = ArtSegment[][];

function ghostRows(eyes: string): ArtFrame {
  return [
    [{ text: "   ▄███▄   " }],
    [{ text: "  ███████  " }],
    [{ text: " █████████ " }],
    [
      { text: " ██" },
      { text: eyes, tone: "blue" },
      { text: "██" },
      { text: eyes, tone: "blue" },
      { text: "█ " },
    ],
    [{ text: " █████████ " }],
    [{ text: " ████" }, { text: "▄▄", tone: "muted" }, { text: "███ " }],
    [{ text: " █████████ " }],
    [{ text: " ██▀████▀█ " }],
    [{ text: " ▀ ▀▀ ▀▀ ▀ " }],
  ];
}

// A spooky little ghost, three frames: eyes open, half-open, closed.
// The banner stacks them and swaps visibility with CSS steps().
export const GHOST: [ArtFrame, ArtFrame, ArtFrame] = [
  ghostRows("██"),
  ghostRows("▀▀"),
  ghostRows("▄▄"),
];
