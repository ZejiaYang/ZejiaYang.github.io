// ─────────────────────────────────────────────────────────────
//  Site-wide content: this is the main file to make yours.
// ─────────────────────────────────────────────────────────────

export const site = {
  // Used in page titles, metadata, and `whoami`.
  name: "Zejia Yang",

  // The fake shell identity. Prompt looks like: hello@zejia ~ $
  shell: {
    user: "hello",
    host: "zejia",
  },

  // Used as the meta description.
  tagline:
    "Zejia Yang, CS @ Cambridge. ",

  // ~/about.txt: one string per paragraph.
  bio: [
    "I'm a CS fourth-year student at Cambridge who (wants|likes|is going) to build more interesting stuff.",
    "I've interned at Meta and a hedge fund, done a bit of NLP research, and I look after this fake terminal.",
  ],

  // ~/about.txt "## experience": selective, casual one-liners.
  experience: [
    {
      org: "Xantium Group",
      role: "quant developer intern",
      when: "summer 2026",
      what: "Built a pipeline that reads 50k+ news stories a day with LLM filtering, so macro traders only see the ones that matter.",
      how: "Python, React, Flask, PostgreSQL.",
    },
    {
      org: "Meta",
      role: "software engineer intern",
      when: "summer 2025",
      what: "Shadow-testing diagnostics for Spark, plus MCP tooling so 100+ Spark engineers could debug with an LLM sidekick.",
      how: "React, GraphQL, Spark, MCP.",
    },
    {
      org: "Cambridge NLP group",
      role: "research intern",
      when: "summer 2024",
      what: "LoRA-fine-tuned BERT and wrangled Llama prompts for group-problem-solving agents, with Prof. Andreas Vlachos.",
      how: "PyTorch, Hugging Face, LoRA.",
    },
  ],

  // ~/about.txt "## education".
  education: [
    "University of Cambridge, BA + MEng Computer Science, 2023–2027",
    "Peking University, Computer Science / AI, 2022–2023",
  ],

  // Used for metadataBase (Open Graph URLs). No trailing slash.
  url: "https://zejiayang.github.io",

  email: "go ask me in-person.com",

  // Listed in ~/elsewhere.txt, ~/about.txt, and the dashboard.
  // Leave `href` out for entries that shouldn't be links.
  socials: [
    {
      label: "GitHub",
      handle: "@ZejiaYang",
      href: "https://github.com/ZejiaYang",
    },
    {
      label: "LinkedIn",
      handle: "zejia-yang",
      href: "https://www.linkedin.com/in/zejia-yang-ab601127b/",
    },
    {
      label: "Email",
      handle: "go ask me in-person.com",
    },
  ] as { label: string; handle: string; href?: string }[],

  // Dashboard pane: what you're up to right now (one or two lines).
  now: "Hours of manifesting meaninglessness. Occasionally something compiles.",

  // Dashboard pane + `skills` command: skill meters. Bars wander
  // between min and max (0–1), battery-style; max is the nominal %.
  skills: [
    { label: "python", min: 0.85, max: 0.95 },
    { label: "c++", min: 0.6, max: 0.8 },
    { label: "ocaml", min: 0.55, max: 0.75 },
    { label: "typescript", min: 0.7, max: 0.85 },
  ],

  // Dashboard pane + `mood` command: fake telemetry, but for your
  // mood. Bars wander between min and max (0–1); label is the joke.
  mood: [
    { label: "energy", min: 0.25, max: 0.8 },
    { label: "caffeine", min: 0.4, max: 0.9 },
    { label: "vibe", min: 0.6, max: 0.95 },
  ],

  // A sentence for the day: the date picks which one shows up
  // (dashboard clock section and the `fortune` command).
  fortunes: [
    "Ship something small today.",
    "The borrow checker is always right.",
    "It works on my machine, which is this website.",
    "Hours of manifesting meaninglessness.",
  ],
};
