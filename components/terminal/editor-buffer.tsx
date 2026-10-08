"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { displayPath, type FsFile } from "@/lib/shell/fs";
import type { Tone } from "@/lib/shell/lines";
import OutLineView from "./line-view";

// The editor has its own colorscheme, distinct from the terminal's:
// headers blue→purple, links cyan→blue, list markers orange→red.
const EDITOR_TONE_MAP: Partial<Record<Tone, Tone>> = {
  blue: "purple",
  cyan: "blue",
  orange: "red",
};

type Props = {
  path: string[];
  file: FsFile;
  onQuit: () => void;
};

type Cmdline =
  | { state: "closed" }
  | { state: "open"; buf: string; flash?: string };

export default function EditorBuffer({ path, file, onQuit }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastKeyRef = useRef<string | null>(null);
  const [pct, setPct] = useState("Top");
  const [topLine, setTopLine] = useState(1);
  const [cmdline, setCmdline] = useState<Cmdline>({ state: "closed" });

  const lines = file.edLines;
  const gutter = String(lines.length).length;
  const name = displayPath(path);

  const updatePosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setPct("All");
      setTopLine(1);
      return;
    }
    const ratio = scrollTop / (scrollHeight - clientHeight);
    setPct(ratio <= 0.01 ? "Top" : ratio >= 0.99 ? "Bot" : `${Math.round(ratio * 100)}%`);
    const lineHeight = 24; // close enough for the status readout
    setTopLine(Math.min(lines.length, Math.floor(scrollTop / lineHeight) + 1));
  }, [lines.length]);

  const scrollByPx = useCallback((amount: number) => {
    scrollRef.current?.scrollBy({ top: amount });
  }, []);

  const scrollToRatio = useCallback((ratio: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: ratio * (el.scrollHeight - el.clientHeight) });
  }, []);

  const runEx = useCallback(
    (buf: string) => {
      const cmd = buf.trim();
      if (cmd === "q" || cmd === "q!") {
        onQuit();
      } else if (cmd === "w" || cmd === "wq" || cmd === "wq!" || cmd === "x") {
        setCmdline({ state: "open", buf: "", flash: `E45: 'readonly' option is set` });
      } else if (cmd.length > 0) {
        setCmdline({ state: "open", buf: "", flash: `Not an editor command: ${cmd}` });
      } else {
        setCmdline({ state: "closed" });
      }
    },
    [onQuit],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // While the ex command line is open it owns the keyboard.
      if (cmdline.state === "open") {
        if (e.key === "Escape") {
          e.preventDefault();
          setCmdline({ state: "closed" });
        } else if (e.key === "Enter") {
          e.preventDefault();
          runEx(cmdline.buf);
        } else if (e.key === "Backspace") {
          e.preventDefault();
          const buf = cmdline.buf.slice(0, -1);
          setCmdline(buf ? { state: "open", buf } : { state: "closed" });
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setCmdline({ state: "open", buf: cmdline.buf + e.key });
        }
        return;
      }

      const line = 24;
      const half = (scrollRef.current?.clientHeight ?? 400) / 2;
      const full = scrollRef.current?.clientHeight ?? 400;

      if (e.key === "g") {
        if (lastKeyRef.current === "g") {
          e.preventDefault();
          scrollToRatio(0);
        }
        lastKeyRef.current = "g";
        return;
      }
      lastKeyRef.current = null;

      if (e.ctrlKey && (e.key === "d" || e.key === "u")) {
        e.preventDefault();
        scrollByPx(e.key === "d" ? half : -half);
        return;
      }

      switch (e.key) {
        case "q":
        case "Escape":
          e.preventDefault();
          onQuit();
          return;
        case ":":
          e.preventDefault();
          setCmdline({ state: "open", buf: "" });
          return;
        case "j":
        case "ArrowDown":
          e.preventDefault();
          scrollByPx(line);
          return;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          scrollByPx(-line);
          return;
        case " ":
        case "PageDown":
          e.preventDefault();
          scrollByPx(full);
          return;
        case "b":
        case "PageUp":
          e.preventDefault();
          scrollByPx(-full);
          return;
        case "G":
          e.preventDefault();
          scrollToRatio(1);
          return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cmdline, onQuit, runEx, scrollByPx, scrollToRatio]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-editor">
      <div
        ref={scrollRef}
        onScroll={updatePosition}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-2"
      >
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span
              aria-hidden="true"
              className="shrink-0 select-none pr-3 text-right text-muted/60"
              style={{ width: `${gutter + 2}ch` }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <OutLineView line={line} toneMap={EDITOR_TONE_MAP} />
            </div>
          </div>
        ))}
        <div aria-hidden="true" className="pt-2 text-muted/60">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i}>~</div>
          ))}
        </div>
      </div>

      {/* status line */}
      <div className="flex items-center gap-2 border-t border-line bg-mantle px-2 py-1 text-[12px]">
        <span className="rounded-sm bg-blue px-1.5 font-bold text-base">NORMAL</span>
        <span className="truncate text-muted">
          {name} <span className="text-orange">[ro]</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-3 text-muted">
          <span
            data-cmd="help"
            role="button"
            tabIndex={-1}
            className="cursor-pointer rounded px-1 hover:text-fg"
          >
            ?: help
          </span>
          <button
            type="button"
            onClick={onQuit}
            className="cursor-pointer rounded px-1 hover:text-fg"
          >
            q: quit
          </button>
          <span aria-hidden="true">
            {topLine},1&nbsp;&nbsp;{pct}
          </span>
        </span>
      </div>

      {/* ex command line */}
      {cmdline.state === "open" && (
        <div className="border-t border-line bg-editor px-2 py-1 text-[13px]">
          {cmdline.flash ? (
            <span className="text-red">{cmdline.flash}</span>
          ) : (
            <span>
              :{cmdline.buf}
              <span className="cursor-blink -mb-0.5 inline-block h-4 w-[7px] bg-fg" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
