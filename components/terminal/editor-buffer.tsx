"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  useId,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import type { FsFile } from "@/lib/shell/fs";
import { withBasePath } from "@/lib/urls";
import type { OutLine, Tone } from "@/lib/shell/lines";
import OutLineView from "./line-view";

// The editor has its own colorscheme, distinct from the terminal's:
// headers blue→purple, links cyan→blue, list markers orange→red.
const EDITOR_TONE_MAP: Partial<Record<Tone, Tone>> = {
  blue: "purple",
  cyan: "blue",
  orange: "red",
};
const EMPTY_LINES: OutLine[] = [];

type Props = {
  path: string[];
  file: FsFile;
  onQuit: () => void;
};

type Cmdline =
  { state: "closed" } | { state: "open"; buf: string; flash?: string };

type LineGroup = {
  kind: "prose" | "code";
  start: number;
  lines: OutLine[];
};

/** Keep source lines intact; only fenced code gets horizontal scrolling. */
function groupLines(lines: OutLine[]): LineGroup[] {
  const groups: LineGroup[] = [];
  let fence: { marker: string; length: number; group: LineGroup } | null = null;

  lines.forEach((line, index) => {
    const source = line.spans.map((span) => span.text).join("");
    const match = source.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);

    if (fence) {
      fence.group.lines.push(line);
      if (
        match &&
        match[1][0] === fence.marker &&
        match[1].length >= fence.length &&
        match[2].trim() === ""
      ) {
        fence = null;
      }
      return;
    }

    if (match) {
      const group: LineGroup = { kind: "code", start: index, lines: [line] };
      groups.push(group);
      fence = { marker: match[1][0], length: match[1].length, group };
      return;
    }

    const previous = groups[groups.length - 1];
    if (previous?.kind === "prose") previous.lines.push(line);
    else groups.push({ kind: "prose", start: index, lines: [line] });
  });

  return groups;
}

export default function EditorBuffer({ path, file, onQuit }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lastKeyRef = useRef<string | null>(null);
  const shortcutHintId = useId();
  const [pct, setPct] = useState("Top");
  const [topLine, setTopLine] = useState(1);
  const [cmdline, setCmdline] = useState<Cmdline>({ state: "closed" });

  const lines = file.edLines ?? EMPTY_LINES;
  const groups = useMemo(() => groupLines(lines), [lines]);
  const gutter = String(lines.length).length;
  const name = "/" + path.join("/");

  const updatePosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setPct("All");
      setTopLine(1);
      return;
    }
    const ratio = Math.max(
      0,
      Math.min(1, scrollTop / (scrollHeight - clientHeight)),
    );
    setPct(
      ratio <= 0.01
        ? "Top"
        : ratio >= 0.99
          ? "Bot"
          : `${Math.round(ratio * 100)}%`,
    );

    // Wrapping changes row heights. Find the first source row actually visible,
    // rather than pretending every source line occupies exactly 24px.
    const viewportTop = el.getBoundingClientRect().top + el.clientTop;
    let lo = 0;
    let hi = lines.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const bottom =
        lineRefs.current[mid]?.getBoundingClientRect().bottom ?? Infinity;
      if (bottom <= viewportTop + 1) lo = mid + 1;
      else hi = mid;
    }
    setTopLine(Math.max(1, Math.min(lines.length, lo + 1)));
  }, [lines.length]);

  useEffect(() => {
    scrollRef.current?.focus({ preventScroll: true });
  }, [name]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(updatePosition);
    const resize = new ResizeObserver(updatePosition);
    resize.observe(el);
    if (contentRef.current) resize.observe(contentRef.current);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [name, updatePosition]);

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
        setCmdline({
          state: "open",
          buf: "",
          flash: `E45: 'readonly' option is set`,
        });
      } else if (cmd.length > 0) {
        setCmdline({
          state: "open",
          buf: "",
          flash: `Not an editor command: ${cmd}`,
        });
      } else {
        setCmdline({ state: "closed" });
      }
    },
    [onQuit],
  );

  // Reading-area shortcuts never own the window or interfere with native
  // controls. Tab remains native, and focus can leave this pane normally.
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        e.defaultPrevented ||
        e.nativeEvent.isComposing ||
        e.nativeEvent.keyCode === 229 ||
        target.closest(
          "input, textarea, select, button, a, [contenteditable]:not([contenteditable='false'])",
        )
      ) {
        lastKeyRef.current = null;
        return;
      }
      if (e.metaKey || e.altKey) {
        lastKeyRef.current = null;
        return;
      }

      const line = 24;
      const half = (scrollRef.current?.clientHeight ?? 400) / 2;
      const full = scrollRef.current?.clientHeight ?? 400;

      if (e.ctrlKey) {
        lastKeyRef.current = null;
        const key = e.key.toLowerCase();
        if (
          cmdline.state === "closed" &&
          !e.shiftKey &&
          (key === "d" || key === "u")
        ) {
          e.preventDefault();
          scrollByPx(key === "d" ? half : -half);
        }
        return;
      }
      if (
        e.shiftKey &&
        e.key !== "G" &&
        e.key !== ":" &&
        !(cmdline.state === "open" && e.key.length === 1)
      ) {
        lastKeyRef.current = null;
        return;
      }

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
        } else if (e.key.length === 1) {
          e.preventDefault();
          setCmdline({ state: "open", buf: cmdline.buf + e.key });
        }
        return;
      }

      if (e.key === "g") {
        if (lastKeyRef.current === "g") {
          e.preventDefault();
          scrollToRatio(0);
        }
        lastKeyRef.current = "g";
        return;
      }
      lastKeyRef.current = null;

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
    },
    [cmdline, onQuit, runEx, scrollByPx, scrollToRatio],
  );

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-editor">
      <div
        ref={scrollRef}
        role="region"
        aria-label={`Read-only file ${name}`}
        aria-describedby={shortcutHintId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => {
          lastKeyRef.current = null;
        }}
        onScroll={updatePosition}
        className="editor-reading min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
      >
        <p id={shortcutHintId} className="sr-only">
          Read-only editor. Press q or Escape to quit, or type :q then Enter.
          Use j and k to scroll, gg for the top, G for the bottom, Space or b
          for a page, and Control+D or Control+U for a half page. Tab moves to
          links and controls.
        </p>
        <div
          ref={contentRef}
          className="editor-document"
          style={{ "--gutter-width": `${gutter + 2}ch` } as CSSProperties}
        >
          {groups.map((group) =>
            group.kind === "code" ? (
              <div key={group.start} className="flex">
                <div aria-hidden="true" className="editor-gutter">
                  {group.lines.map((_, i) => (
                    <div key={i}>{group.start + i + 1}</div>
                  ))}
                </div>
                <div
                  role="region"
                  aria-label={`Code block starting at line ${group.start + 1}`}
                  tabIndex={0}
                  className="editor-code-scroll"
                >
                  <div className="editor-code-content">
                    {group.lines.map((line, i) => (
                      <div
                        key={i}
                        data-source-line={group.start + i + 1}
                        ref={(el) => {
                          lineRefs.current[group.start + i] = el;
                        }}
                      >
                        <OutLineView
                          line={line}
                          toneMap={EDITOR_TONE_MAP}
                          preserveWhitespace
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              group.lines.map((line, i) => (
                <div
                  key={group.start + i}
                  data-source-line={group.start + i + 1}
                  ref={(el) => {
                    lineRefs.current[group.start + i] = el;
                  }}
                  className="flex"
                >
                  <span aria-hidden="true" className="editor-gutter">
                    {group.start + i + 1}
                  </span>
                  <div className="editor-line-text">
                    <OutLineView line={line} toneMap={EDITOR_TONE_MAP} />
                  </div>
                </div>
              ))
            ),
          )}
          <div aria-hidden="true" className="pt-2 text-muted/60">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i}>~</div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line bg-mantle px-2 py-1 text-[12px]">
        <span className="rounded-sm bg-blue px-1.5 font-bold text-base">
          NORMAL
        </span>
        <span className="min-w-0 truncate text-muted">
          {name} <span className="text-orange">[ro]</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-3 text-muted">
          {file.canonicalUrl && (
            <a
              href={withBasePath(file.canonicalUrl)}
              aria-label="permalink to this file"
              className="rounded px-1 hover:text-fg"
            >
              link
            </a>
          )}
          <button
            type="button"
            data-cmd="help"
            className="command-button rounded px-1 hover:text-fg"
          >
            ?: help
          </button>
          <button
            type="button"
            onClick={onQuit}
            className="cursor-pointer rounded px-1 hover:text-fg"
          >
            q: quit
          </button>
          <span aria-hidden="true" className="tabular-nums">
            {topLine},1&nbsp;&nbsp;{pct}
          </span>
        </span>
      </div>

      {cmdline.state === "open" && (
        <div className="border-t border-line bg-editor px-2 py-1 text-[13px]">
          {cmdline.flash ? (
            <span role="status" className="text-red">
              {cmdline.flash}
            </span>
          ) : (
            <span>
              :{cmdline.buf}
              <span
                aria-hidden="true"
                className="cursor-blink -mb-0.5 inline-block h-4 w-[7px] bg-fg"
              />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
