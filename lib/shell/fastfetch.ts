// Data for the `fastfetch` command: rendered by the Fastfetch
// component (components/terminal/fastfetch.tsx) as a real layout,
// not padded text, so it can never misalign.

import { site } from "@/lib/site";

export const FASTFETCH_ART = [
  "  ┌─────────┐",
  "  │ >_      │",
  "  │         │",
  "  │         │",
  "  └─────────┘",
];

/** [label, value] pairs. Empty value = printed as a bare line. */
export function fastfetchFacts(): [string, string][] {
  const handle = `${site.shell.user}@${site.shell.host}`;
  return [
    [handle, ""],
    ["─".repeat(handle.length), ""],
    ["os", "anything with a browser"],
    ["shell", "zsh, allegedly"],
    ["editor", "vim (the only editor)"],
    ["palette", "tokyo night"],
    ["stack", "next.js · static export"],
    ["uptime", "since 2026"],
  ];
}
