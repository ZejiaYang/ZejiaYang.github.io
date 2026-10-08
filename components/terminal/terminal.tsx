"use client";

import {
  memo,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { site } from "@/lib/site";
import { nodeAt, formatCwd, type FsDir, type FsFile } from "@/lib/shell/fs";
import {
  runCommand,
  type CmdResult,
  type EditorTarget,
} from "@/lib/shell/commands";
import {
  commandFromHash,
  completeBuffer,
  locationHash,
  shellReducer,
  type ShellAction,
  type ShellState,
} from "@/lib/shell/state";
import {
  isCmdLine,
  isBlockLine,
  type Line,
  type OutLine,
} from "@/lib/shell/lines";
import { applyTheme, getTheme, subscribeTheme } from "@/lib/theme";
import {
  getDashboardFolded,
  setDashboardFolded,
  subscribeDashboard,
} from "@/lib/preferences";
import { withBasePath } from "@/lib/urls";
import { getMeterSnapshot } from "@/lib/telemetry";
import Prompt from "./prompt";
import OutLineView from "./line-view";
import EditorBuffer from "./editor-buffer";
import Banner from "./banner";
import Dashboard from "./dashboard";
import Fastfetch from "./fastfetch";
import { MoonIcon, SunIcon } from "../icons";

const Scrollback = memo(function Scrollback({ lines }: { lines: Line[] }) {
  return lines.map((line, index) => {
    if (isBlockLine(line))
      return line.block === "banner" ? (
        <Banner key={index} />
      ) : (
        <Fastfetch key={index} />
      );
    if (isCmdLine(line))
      return (
        <div key={index} className="whitespace-pre-wrap break-words">
          <Prompt cwd={line.cwd} />
          <span>{line.text}</span>
        </div>
      );
    return <OutLineView key={index} line={line} />;
  });
});

type Props = {
  root: FsDir;
  initialLines: Line[];
  initialCwd: string[];
  initialEditor?: EditorTarget | null;
};

export default function Terminal({
  root,
  initialLines,
  initialCwd,
  initialEditor = null,
}: Props) {
  const initialState: ShellState = {
    lines: initialLines,
    cwd: initialCwd,
    prevCwd: null,
    history: [],
    editor: initialEditor,
  };
  const [state, dispatch] = useReducer(shellReducer, initialState);
  const stateRef = useRef(initialState);
  const [buf, setBuf] = useState("");
  const [caret, setCaret] = useState(0);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTab = useRef<string | null>(null);
  const draft = useRef("");
  const requestId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const contentCache = useRef(new Map<string, OutLine[]>());
  const previousEditor = useRef(initialEditor);
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "dark");
  const dashFolded = useSyncExternalStore(
    subscribeDashboard,
    getDashboardFolded,
    () => false,
  );
  const blog = nodeAt(root, ["home", "blog"]);
  const blogFiles =
    blog?.type === "dir"
      ? blog.children.filter((node): node is FsFile => node.type === "file")
      : [];

  const commit = useCallback((action: ShellAction) => {
    stateRef.current = shellReducer(stateRef.current, action);
    dispatch(action);
  }, []);

  const run = useCallback(
    async (raw: string) => {
      const id = ++requestId.current;
      activeRequest.current?.abort();
      activeRequest.current = null;
      setBusy(false);
      const current = stateRef.current;
      let result: CmdResult = runCommand(raw, {
        root,
        cwd: current.cwd,
        prevCwd: current.prevCwd,
        history: current.history,
        meters: getMeterSnapshot(),
      });
      if (result.openUrl)
        window.open(result.openUrl, "_blank", "noopener,noreferrer");
      if (result.theme)
        applyTheme(
          result.theme === "toggle"
            ? getTheme() === "dark"
              ? "light"
              : "dark"
            : result.theme,
        );
      if (result.read) {
        const read = result.read;
        const key = read.path.join("/");
        try {
          let lines = contentCache.current.get(key);
          if (!lines) {
            if (!read.file.contentUrl)
              throw new Error("file has no content URL");
            const controller = new AbortController();
            activeRequest.current = controller;
            setBusy(true);
            const response = await fetch(withBasePath(read.file.contentUrl), {
              signal: controller.signal,
            });
            if (!response.ok)
              throw new Error(`request returned ${response.status}`);
            const data: { lines?: OutLine[] } = await response.json();
            if (!Array.isArray(data.lines))
              throw new Error("invalid file content");
            lines = data.lines;
            contentCache.current.set(key, lines);
          }
          if (id !== requestId.current) return;
          const file = { ...read.file, edLines: lines };
          result =
            read.mode === "cat"
              ? { out: lines }
              : { editor: { path: read.path, file } };
        } catch (error) {
          if (id !== requestId.current) return;
          result = {
            out: [
              {
                spans: [
                  {
                    text: `couldn't read ${read.file.name}: ${error instanceof Error ? error.message : "request failed"}`,
                    tone: "red",
                  },
                ],
              },
            ],
          };
        } finally {
          if (id === requestId.current) {
            activeRequest.current = null;
            setBusy(false);
          }
        }
      }
      if (id === requestId.current) commit({ type: "command", raw, result });
    },
    [root, commit],
  );

  const cancelRead = useCallback(() => {
    ++requestId.current;
    activeRequest.current?.abort();
  }, []);

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const raw = commandFromHash(window.location.hash);
        if (raw !== null) await run(raw);
        else if (!window.location.hash)
          commit({ type: "restore", cwd: initialCwd, editor: initialEditor });
      } catch {
        commit({
          type: "echo",
          line: {
            spans: [
              { text: "couldn't read that link. try help.", tone: "red" },
            ],
          },
        });
      }
    };
    const bootstrap = async () => {
      await restore();
      if (mounted) setUrlReady(true);
    };
    void bootstrap();
    window.addEventListener("hashchange", restore);
    return () => {
      mounted = false;
      window.removeEventListener("hashchange", restore);
      cancelRead();
    };
  }, [run, commit, cancelRead, initialCwd, initialEditor]);

  useEffect(() => {
    if (!urlReady) return;
    const hash = locationHash(state, initialCwd, initialEditor);
    const next = window.location.pathname + window.location.search + hash;
    if (window.location.hash !== hash)
      window.history.replaceState(null, "", next);
  }, [state, urlReady, initialCwd, initialEditor]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [state.lines]);

  useEffect(() => {
    if (previousEditor.current && !state.editor) inputRef.current?.focus();
    previousEditor.current = state.editor;
  }, [state.editor]);

  function replaceInput(value: string) {
    setBuf(value);
    setCaret(value.length);
    requestAnimationFrame(() =>
      inputRef.current?.setSelectionRange(value.length, value.length),
    );
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (busy) return;
      const raw = buf;
      replaceInput("");
      setHistIdx(null);
      lastTab.current = null;
      void run(raw);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (!state.history.length) return;
      if (event.key === "ArrowUp") {
        if (histIdx === null) draft.current = buf;
        const index =
          histIdx === null
            ? state.history.length - 1
            : Math.max(0, histIdx - 1);
        setHistIdx(index);
        replaceInput(state.history[index]);
      } else if (histIdx !== null) {
        const index = histIdx + 1;
        setHistIdx(index < state.history.length ? index : null);
        replaceInput(
          index < state.history.length ? state.history[index] : draft.current,
        );
      }
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      cancelRead();
      setBusy(false);
      commit({ type: "clear" });
      setHistIdx(null);
      draft.current = "";
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "c") {
      if (
        event.currentTarget.selectionStart !== event.currentTarget.selectionEnd
      )
        return;
      event.preventDefault();
      ++requestId.current;
      activeRequest.current?.abort();
      setBusy(false);
      commit({
        type: "echo",
        line: { kind: "cmd", cwd: state.cwd, text: `${buf}^C` },
      });
      replaceInput("");
      setHistIdx(null);
      return;
    }
    if (event.key === "Tab" && !event.shiftKey && buf.trim()) {
      const { next, matches } = completeBuffer(buf, state.cwd, root);
      if (!matches.length) return;
      event.preventDefault();
      if (next === buf && matches.length > 1 && lastTab.current === buf) {
        commit({
          type: "echo",
          line: { spans: [{ text: matches.join("   "), tone: "muted" }] },
        });
        lastTab.current = null;
      } else lastTab.current = next === buf ? buf : null;
      replaceInput(next);
      return;
    }
    lastTab.current = null;
  }

  const quitEditor = useCallback(() => commit({ type: "quit" }), [commit]);
  const promptWidth =
    site.shell.user.length +
    site.shell.host.length +
    formatCwd(state.cwd).length +
    5;
  const cursorCharacter =
    new Intl.Segmenter(undefined, { granularity: "grapheme" })
      .segment(buf.slice(caret))
      [Symbol.iterator]()
      .next().value?.segment ?? " ";

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-base sm:rounded-xl sm:border sm:border-line sm:shadow-2xl sm:shadow-black/40"
      onClick={(event) => {
        const target = event.target as HTMLElement;
        const command = target.closest<HTMLElement>("[data-cmd]")?.dataset.cmd;
        if (command) {
          if (
            target.closest("a") &&
            (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          )
            return;
          event.preventDefault();
          void run(command);
          return;
        }
        if (target.closest("button, a, input, [tabindex]")) return;
        if (!stateRef.current.editor && !window.getSelection()?.toString())
          inputRef.current?.focus();
      }}
    >
      <div className="relative flex items-center border-b border-line bg-mantle px-3 py-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-red/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-orange/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green/70" />
        </div>
        <span className="absolute left-1/2 max-w-[70%] -translate-x-1/2 truncate text-[11px] text-muted">
          {site.shell.user}@{site.shell.host}: {formatCwd(state.cwd)}
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            data-testid="scrollback"
            aria-live="polite"
            aria-hidden={Boolean(state.editor)}
            inert={Boolean(state.editor)}
            className="flex-1 overflow-y-auto overscroll-contain px-3 pt-3 sm:px-4"
          >
            <Scrollback lines={state.lines} />
            {!state.editor && (
              <div className="relative whitespace-pre-wrap break-words pb-4">
                <span aria-hidden="true">
                  <Prompt cwd={state.cwd} />
                  <span>{buf.slice(0, caret)}</span>
                  <span
                    className="cursor-blink inline-block min-w-[1ch] bg-fg"
                    style={{ color: "var(--base)" }}
                  >
                    {cursorCharacter}
                  </span>
                  <span>
                    {buf.slice(
                      caret + (caret < buf.length ? cursorCharacter.length : 0),
                    )}
                  </span>
                </span>
                <input
                  ref={inputRef}
                  value={buf}
                  onChange={(event) => {
                    setBuf(event.target.value);
                    setCaret(
                      event.target.selectionStart ?? event.target.value.length,
                    );
                    setHistIdx(null);
                  }}
                  onSelect={(event) =>
                    setCaret(event.currentTarget.selectionStart ?? buf.length)
                  }
                  onKeyDown={onInputKeyDown}
                  autoFocus={!initialEditor}
                  aria-label="terminal input"
                  aria-describedby="terminal-input-help"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="absolute left-0 top-0 h-[1.6em] w-full cursor-text opacity-0"
                  style={{ paddingLeft: `${promptWidth}ch` }}
                />
                <span
                  id="terminal-input-help"
                  className="mt-2 block text-xs text-muted"
                >
                  # ↑/↓ = command history. touchpad/wheel = scroll.
                  <span className="sr-only">
                    {" "}
                    Type help for commands. Tab completes partially typed
                    commands. Shift+Tab leaves the prompt.
                  </span>
                </span>
              </div>
            )}
            {busy && (
              <p role="status" className="pb-3 text-muted">
                reading file…
              </p>
            )}
          </div>
          {state.editor && (
            <EditorBuffer
              key={state.editor.path.join("/")}
              path={state.editor.path}
              file={state.editor.file}
              onQuit={quitEditor}
            />
          )}
        </div>
        {!dashFolded && (
          <aside
            aria-label="dashboard"
            className="hidden w-72 shrink-0 border-l border-line bg-mantle/40 lg:block xl:w-80"
          >
            <Dashboard
              onFold={() => setDashboardFolded(true)}
              posts={blogFiles}
              emptyBlogNote={blog?.type === "dir" ? blog.emptyNote : undefined}
            />
          </aside>
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-line bg-mantle px-3 py-1.5 text-[11px] text-muted">
        <span>
          <span className="font-bold text-green">
            [0:shell{dashFolded ? "Z" : ""}]
          </span>{" "}
          <button
            type="button"
            onClick={() => setDashboardFolded(!dashFolded)}
            aria-label="toggle dashboard pane"
            aria-pressed={!dashFolded}
            title={dashFolded ? "unfold dashboard pane" : "fold dashboard pane"}
            className="hidden text-muted hover:text-fg lg:inline"
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
            className="flex h-6 w-6 items-center justify-center rounded hover:text-fg"
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
            onClick={() => void run("help")}
            className="flex h-6 w-6 items-center justify-center rounded font-bold hover:text-fg"
          >
            ?
          </button>
        </span>
      </div>
    </div>
  );
}
