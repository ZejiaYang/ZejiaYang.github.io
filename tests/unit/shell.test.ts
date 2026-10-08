import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFs } from "../../lib/content";
import { HOME, nodeAt, resolve, stripContent } from "../../lib/shell/fs";
import {
  getQuickCommands,
  getShortcut,
  runCommand,
  type CmdContext,
} from "../../lib/shell/commands";
import {
  commandFromHash,
  completeBuffer,
  locationHash,
  shellReducer,
  type ShellState,
} from "../../lib/shell/state";
import { dayOfYear } from "../../lib/shell/calendar";

const root = buildFs();
const context = (cwd = HOME): CmdContext => ({
  root,
  cwd,
  prevCwd: null,
  history: [],
});
const output = (result: ReturnType<typeof runCommand>) =>
  result.out
    ?.map((line) => line.spans.map((span) => span.text).join(""))
    .join("\n") ?? "";
const initial = (): ShellState => ({
  lines: [],
  cwd: HOME,
  prevCwd: null,
  history: [],
  editor: null,
});

test("project open selects one primary URL while preserving all links in the file", () => {
  const result = runCommand("open ~/project/geospatial-mae.md", context());
  assert.equal(result.openUrl, "https://github.com/ZejiaYang/MAE_GeoTessera");
  const file = runCommand("cat ~/project/geospatial-mae.md", context());
  assert.match(output(file), /https:\/\/github.com\/ucam-eo\/tessera/);
});

test("every home shortcut is runnable from any directory", () => {
  for (const cwd of [[], HOME, ["home", "project"], ["home", "blog"]]) {
    for (const shortcut of getQuickCommands())
      assert.doesNotMatch(
        output(runCommand(shortcut.command, context(cwd))),
        /no such file|command not found|unknown theme/,
      );
    assert.match(
      output(runCommand(getShortcut("now").command, context(cwd))),
      /manifesting meaninglessness/,
    );
  }
});

test("help syntax is display-only and every clickable example is a real command", () => {
  const result = runCommand("help", context());
  assert.match(output(result), /theme \[dark\|light\]/);
  const examples = result.out!.flatMap((line) =>
    line.spans.filter((span) => span.cmd),
  );
  assert.ok(examples.length > 5);
  for (const example of examples) {
    assert.doesNotMatch(example.cmd!, /[<>\[\]|·]/);
    assert.doesNotMatch(
      output(runCommand(example.cmd!, context())),
      /command not found|no such file|unknown theme/,
    );
  }
});

test("commands and paths complete from the registry and filesystem", () => {
  assert.equal(completeBuffer("fastf", HOME, root).next, "fastfetch ");
  assert.equal(completeBuffer("cat ~/no", HOME, root).next, "cat ~/now.txt ");
  assert.ok(
    completeBuffer("cd ", HOME, root).matches.every((match) =>
      match.endsWith("/"),
    ),
  );
});

test("shell commands leave the editor and the resulting hash agrees", () => {
  const file = nodeAt(root, ["home", "about.txt"]);
  assert.ok(file?.type === "file");
  const state = { ...initial(), editor: { path: ["home", "about.txt"], file } };
  const next = shellReducer(state, {
    type: "command",
    raw: "help",
    result: runCommand("help", context()),
  });
  assert.equal(next.editor, null);
  assert.equal(locationHash(next, HOME), "");
});

test("commands are evaluated with current cwd and previous directory", () => {
  let state = initial();
  state = shellReducer(state, {
    type: "command",
    raw: "cd project",
    result: runCommand("cd project", context()),
  });
  const ctx = {
    root,
    cwd: state.cwd,
    prevCwd: state.prevCwd,
    history: state.history,
  };
  assert.equal(
    output(runCommand(commandFromHash("#run:pwd")!, ctx)),
    "/home/project",
  );
  assert.deepEqual(runCommand("cd -", ctx).cwd, HOME);
  assert.equal(commandFromHash(locationHash(state, HOME)), 'cd "~/project"');
});

test("content metadata does not contain the complete content corpus", () => {
  const metadata = stripContent(root);
  const file = resolve(metadata, HOME, "about.txt");
  assert.ok(file?.node.type === "file");
  assert.equal(file.node.edLines, undefined);
  assert.match(file.node.contentUrl!, /about\.txt\.json$/);
  assert.ok(file.node.size! > 0);
  assert.equal(
    runCommand("vim about.txt", { ...context(), root: metadata }).read?.mode,
    "vim",
  );
});

test("empty directories retain their authored notes", () => {
  const fixture = structuredClone(root);
  const blog = nodeAt(fixture, ["home", "blog"]);
  assert.ok(blog?.type === "dir");
  blog.children = [];
  assert.equal(
    output(runCommand("ls ~/blog", { ...context(), root: fixture })),
    blog.emptyNote,
  );
});

test("file paths resolve tilde and aliases without traversing through files", () => {
  assert.deepEqual(resolve(root, HOME, "./things-i-made")?.path, [
    "home",
    "project",
  ]);
  assert.deepEqual(resolve(root, ["home", "project"], "../now.txt")?.path, [
    "home",
    "now.txt",
  ]);
  assert.equal(resolve(root, HOME, "now.txt/not-a-directory"), null);
});

test("history and output remain bounded", () => {
  let state = initial();
  for (let i = 0; i < 1100; i++)
    state = shellReducer(state, {
      type: "command",
      raw: `echo ${i}`,
      result: { out: [{ spans: [{ text: String(i) }] }] },
    });
  assert.equal(state.history.length, 200);
  assert.equal(state.lines.length, 1000);
});

test("skills lists the CV without ratings; usage and mood snapshot supplied live values", () => {
  const meters = {
    mood: { energy: 42, caffeine: 61, vibe: 78 },
    skills: { python: 88, "c++": 66, ocaml: 57, typescript: 73 },
  };
  const ctx = { ...context(), meters };
  const skills = output(runCommand("skills", ctx));
  assert.match(skills, /Python.*C\+\+/);
  assert.match(skills, /Hugging Face/);
  assert.match(skills, /OpenTelemetry/);
  assert.doesNotMatch(skills, /%|█|░/);
  assert.match(output(runCommand("skills --usage", ctx)), /88%/);
  const mood = runCommand("mood", ctx);
  assert.match(output(mood), /42%/);
  meters.mood.energy = 80;
  assert.match(output(mood), /42%/);
  assert.doesNotMatch(output(mood), /80%/);
});

test("clear and Ctrl+L clear history without changing cwd", () => {
  let state = shellReducer(initial(), {
    type: "command",
    raw: "cd project",
    result: runCommand("cd project", context()),
  });
  const cleared = shellReducer(state, {
    type: "command",
    raw: "clear",
    result: { clear: true },
  });
  assert.deepEqual(cleared.history, []);
  assert.deepEqual(cleared.lines, []);
  assert.deepEqual(cleared.cwd, ["home", "project"]);
  state = shellReducer(state, { type: "clear" });
  assert.deepEqual(state.history, []);
  assert.deepEqual(state.lines, []);
});

test("day of year counts calendar dates rather than daylight-saving hours", () => {
  assert.equal(dayOfYear(new Date(2026, 6, 1)), 182);
  assert.equal(dayOfYear(new Date(2028, 11, 31)), 366);
});

test("malformed URL encoding throws into the caller's recoverable error path", () => {
  assert.throws(() => commandFromHash("#run:%E0%A4%A"), URIError);
});
