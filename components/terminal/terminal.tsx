"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { site } from "@/lib/site";
import {
  buildFs,
  formatCwd,
  resolve,
  type FsDir,
  type FsFile,
} from "@/lib/shell/fs";
import {
  runCommand,
  COMMAND_NAMES,
  type CmdResult,
} from "@/lib/shell/commands";
import { isCmdLine, isBlockLine, type Line } from "@/lib/shell/lines";
import { applyTheme, getTheme, subscribeTheme } from "@/lib/theme";
import Prompt from "./prompt";
import OutLineView from "./line-view";
import EditorBuffer from "./editor-buffer";
import Banner from "./banner";
import Dashboard from "./dashboard";
import Fastfetch from "./fastfetch";
import { MoonIcon, SunIcon } from "../icons";

const ROOT = buildFs();

type State = {
  lines: Line[];
  cwd: string[];
  prevCwd: string[] | null;
  history: string[];
  editor: { path: string[]; file: FsFile } | null;
};

type Action =
  | { type: "ran"; raw: string; res: CmdResult }
  | { type: "cleared" }
  | { type: "echoed"; line: Line }
  | { type: "editor-quit" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ran": {
      const { raw, res } = action;
      const echo: Line = { kind: "cmd", cwd: state.cwd, text: raw };
      const history =
        raw.trim() && state.history[state.history.length - 1] !== raw.trim()
          ? [...state.history, raw.trim()]
          : state.history;
      if (res.clear) {
        return { ...state, lines: [], history };
      }
      const blockLine: Line | null = res.block
        ? { kind: "block", block: res.block }
        : null;
      return {
        ...state,
        lines: [
          ...state.lines,
          echo,
          ...(res.out ?? []),
          ...(blockLine ? [blockLine] : []),
        ],
        cwd: res.cwd ?? state.cwd,
        prevCwd: res.cwd ? state.cwd : state.prevCwd,
        editor: res.editor ?? state.editor,
        history,
      };
    }
    case "cleared":
      return { ...state, lines: [] };
    case "echoed":
      return { ...state, lines: [...state.lines, action.line] };
    case "editor-quit":
      return { ...state, editor: null };
  }
}

// ── tab completion ─────────────────────────────────────────────

function longestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return "";
  let lcp = strings[0];
  for (const s of strings.slice(1)) {
    while (!s.startsWith(lcp)) lcp = lcp.slice(0, -1);
  }
  return lcp;
}

function completeBuffer(
  buf: string,
  cwd: string[],
  root: FsDir,
): { next: string; matches: string[] } {
  const endsWithSpace = /\s$/.test(buf);
  const tokens = buf.trimStart().split(/\s+/);

  // First token → complete command names.
  if (tokens.length <= 1 && !endsWithSpace) {
    const matches = COMMAND_NAMES.filter((c) => c.startsWith(buf.trim()));
    if (matches.length === 1) return { next: matches[0] + " ", matches };
    if (matches.length > 1) {
      const lcp = longestCommonPrefix(matches);
      return { next: lcp.length > buf.trim().length ? lcp : buf, matches };
    }
    return { next: buf, matches: [] };
  }

  // Later tokens → complete file paths.
  const token = endsWithSpace ? "" : tokens[tokens.length - 1];
  const head = buf.slice(0, buf.length - token.length);
  const slash = token.lastIndexOf("/");
  const dirPart = slash >= 0 ? token.slice(0, slash + 1) : "";
  const prefix = slash >= 0 ? token.slice(slash + 1) : token;

  const hit = resolve(root, cwd, dirPart || ".");
  if (!hit || hit.node.type !== "dir") return { next: buf, matches: [] };

  const names = hit.node.children
    .filter((c) => !(c.type === "file" && c.hidden && !prefix.startsWith(".")))
    .map((c) => c.name + (c.type === "dir" ? "/" : ""));
  const matches = names.filter((n) => n.startsWith(prefix));

  if (matches.length === 1) {
    const single = matches[0];
    const suffix = single.endsWith("/") ? "" : " ";
    return { next: head + dirPart + single + suffix, matches };
  }
  if (matches.length > 1) {
    const lcp = longestCommonPrefix(matches);
    if (lcp.length > prefix.length) {
      return { next: head + dirPart + lcp, matches };
    }
    return { next: buf, matches };
  }
  return { next: buf, matches: [] };
}

// ── component ──────────────────────────────────────────────────

type Props = {
  initialLines: Line[];
  initialCwd: string[];
};

export default function Terminal({ initialLines, initialCwd }: Props) {
  const [state, dispatch] = useReducer(reducer, {
    lines: initialLines,
    cwd: initialCwd,
    prevCwd: null,
    history: [],
    editor: null,
  });
  const [buf, setBuf] = useState("");
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [dashFolded, setDashFolded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTabRef = useRef<string | null>(null);

  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "dark");

  // Restore the folded-pane preference. The state update happens
  // inside the event callback, not directly in this effect.
  useEffect(() => {
    function restore() {
      try {
        if (localStorage.getItem("dash-folded") === "1") setDashFolded(true);
      } catch {
        // private mode etc.: fold just won't persist
      }
    }
    window.addEventListener("dash-fold-restore", restore);
    window.dispatchEvent(new Event("dash-fold-restore"));
    return () => window.removeEventListener("dash-fold-restore", restore);
  }, []);

  function toggleDash() {
    setDashFolded((folded) => {
      const next = !folded;
      try {
        localStorage.setItem("dash-folded", next ? "1" : "0");
      } catch {
        // ignore: preference just won't persist
      }
      return next;
    });
  }

  // Keep scrolled to the bottom as output accumulates.
  const lineCount = state.lines.length;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lineCount]);

  function focusInput() {
    if (!state.editor) inputRef.current?.focus();
  }

  function syncHash(next: { cwd: string[]; editor: State["editor"] }) {
    if (window.location.pathname !== "/") return;
    let hash = "";
    if (next.editor) {
      hash = `#vim:${next.editor.path.slice(1).join("/")}`;
    } else if (next.cwd.length > 1) {
      hash = `#~/${next.cwd.slice(1).join("/")}`;
    }
    window.history.replaceState(null, "", hash || window.location.pathname);
  }

  function run(raw: string) {
    const res = runCommand(raw, {
      cwd: state.cwd,
      prevCwd: state.prevCwd,
      root: ROOT,
      history: state.history,
    });
    dispatch({ type: "ran", raw, res });
    if (res.openUrl) window.open(res.openUrl, "_blank", "noopener,noreferrer");
    if (res.theme) {
      const next =
        res.theme === "toggle" ? (getTheme() === "dark" ? "light" : "dark") : res.theme;
      applyTheme(next);
    }
    syncHash({
      cwd: res.cwd ?? state.cwd,
      editor: res.editor ?? state.editor,
    });
  }

  function submit() {
    const raw = buf;
    setBuf("");
    setHistIdx(null);
    lastTabRef.current = null;
    run(raw);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (state.history.length === 0) return;
      const idx =
        histIdx === null ? state.history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setBuf(state.history[idx]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === null) return;
      if (histIdx >= state.history.length - 1) {
        setHistIdx(null);
        setBuf("");
      } else {
        setHistIdx(histIdx + 1);
        setBuf(state.history[histIdx + 1]);
      }
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      dispatch({ type: "cleared" });
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      dispatch({
        type: "echoed",
        line: { kind: "cmd", cwd: state.cwd, text: `${buf}^C` },
      });
      setBuf("");
      setHistIdx(null);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const { next, matches } = completeBuffer(buf, state.cwd, ROOT);
      if (next === buf && matches.length > 1 && lastTabRef.current === buf) {
        dispatch({
          type: "echoed",
          line: { spans: [{ text: matches.join("   "), tone: "muted" }] },
        });
        lastTabRef.current = null;
      } else {
        lastTabRef.current = next === buf ? buf : null;
      }
      setBuf(next);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
      // The fake block cursor always sits at the end of the line.
      e.preventDefault();
    }
    lastTabRef.current = null;
  }

  // Restore shell state from the URL hash (shareable links), and
  // re-restore if the hash changes while the page is open.
  useEffect(() => {
    function restoreFromHash() {
      const hash = window.location.hash;
      if (window.location.pathname !== "/" || !hash) return;
      if (hash.startsWith("#vim:")) {
        run(`vim ~/${hash.slice(5)}`);
      } else if (hash.startsWith("#~/")) {
        run(`cd ~/${hash.slice(3)}`);
      } else if (hash.startsWith("#run:")) {
        // shareable "run this command" links, e.g. /#run:fastfetch
        run(decodeURIComponent(hash.slice(5)));
      }
    }
    window.addEventListener("hashchange", restoreFromHash);
    // Trigger once for the initial hash. The state update happens
    // inside the event callback, not directly in this effect.
    window.dispatchEvent(new Event("hashchange"));
    return () => window.removeEventListener("hashchange", restoreFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-base sm:rounded-xl sm:border sm:border-line sm:shadow-2xl sm:shadow-black/40"
      onMouseUp={() => {
        if (window.getSelection()?.toString()) return;
        focusInput();
      }}
      onClick={(e) => {
        const target = (e.target as HTMLElement).closest("[data-cmd]");
        if (!target) return;
        const cmd = target.getAttribute("data-cmd")!;
        // Clickable commands work from inside the editor too: close
        // the buffer first (a vim command will open the new file).
        if (state.editor) dispatch({ type: "editor-quit" });
        run(cmd);
        focusInput();
      }}
    >
      {/* title bar */}
      <div className="relative flex items-center border-b border-line bg-mantle px-3 py-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-red/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-orange/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green/70" />
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-[11px] text-muted">
          {site.shell.user}@{site.shell.host}: {formatCwd(state.cwd)}
        </span>
      </div>

      {/* body: tmux-style panes: shell on the left, dashboard on the right */}
      <div className="relative flex min-h-0 flex-1">
        {/* shell pane (the vim buffer overlays only this pane) */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            aria-live="polite"
            className="flex-1 overflow-y-auto overscroll-contain px-3 pt-3 sm:px-4"
          >
            {state.lines.map((line, i) => {
              if (isBlockLine(line)) {
                return line.block === "banner" ? (
                  <Banner key={i} />
                ) : (
                  <Fastfetch key={i} />
                );
              }
              if (isCmdLine(line)) {
                return (
                  <div key={i} className="whitespace-pre-wrap break-words">
                    <Prompt cwd={line.cwd} />
                    <span>{line.text}</span>
                  </div>
                );
              }
              return <OutLineView key={i} line={line} />;
            })}

            {/* live prompt */}
            {!state.editor && (
              <div className="relative whitespace-pre-wrap break-words pb-4">
                <Prompt cwd={state.cwd} />
                <span>{buf}</span>
                <span
                  aria-hidden="true"
                  className="cursor-blink -mb-0.5 inline-block h-[1.1em] w-[0.55em] bg-fg align-middle"
                />
                <input
                  ref={inputRef}
                  value={buf}
                  onChange={(e) => {
                    setBuf(e.target.value);
                    setHistIdx(null);
                  }}
                  onKeyDown={onInputKeyDown}
                  autoFocus
                  aria-label="terminal input: type a command, or `help`"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="absolute left-0 top-0 h-full w-full cursor-text opacity-0"
                />
              </div>
            )}
          </div>

          {state.editor && (
            <EditorBuffer
              key={state.editor.path.join("/")}
              path={state.editor.path}
              file={state.editor.file}
              onQuit={() => {
                dispatch({ type: "editor-quit" });
                syncHash({ cwd: state.cwd, editor: null });
                focusInput();
              }}
            />
          )}
        </div>

        {/* dashboard pane (foldable: the shell pane "zooms" full-width) */}
        {!dashFolded && (
          <aside className="hidden w-72 shrink-0 border-l border-line bg-mantle/40 lg:block xl:w-80">
            <Dashboard onFold={toggleDash} />
          </aside>
        )}
      </div>

      {/* tmux-style status bar */}
      <div className="flex items-center gap-3 border-t border-line bg-mantle px-3 py-1.5 text-[11px] text-muted">
        <span>
          <span className="font-bold text-green">
            [0:shell{dashFolded ? "Z" : ""}]
          </span>{" "}
          <button
            type="button"
            onClick={toggleDash}
            aria-label="toggle dashboard pane"
            aria-pressed={!dashFolded}
            title={dashFolded ? "unfold dashboard pane" : "fold dashboard pane"}
            className={`hidden lg:inline ${
              dashFolded ? "text-muted/60 hover:text-fg" : "text-muted hover:text-fg"
            }`}
          >
            [1:dash]
          </button>
        </span>
        <span className="hidden sm:inline">{formatCwd(state.cwd)}</span>
        <span className="ml-auto flex items-center gap-3">
          <span className="hidden sm:inline">tokyo-night</span>
          <button
            type="button"
            aria-label="toggle theme"
            onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-5 w-5 items-center justify-center rounded hover:text-fg"
          >
            {theme === "dark" ? (
              <SunIcon className="h-3.5 w-3.5" />
            ) : (
              <MoonIcon className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            aria-label="help"
            onClick={() => {
              run("help");
              focusInput();
            }}
            className="flex h-5 w-5 items-center justify-center rounded font-bold hover:text-fg"
          >
            ?
          </button>
        </span>
      </div>
    </div>
  );
}
