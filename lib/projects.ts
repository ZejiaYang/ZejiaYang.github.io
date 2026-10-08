// ─────────────────────────────────────────────────────────────
//  Projects & publications: each one becomes a file at
//  ~/project/<slug>.md. `href` is what `open <slug>` launches
//  (leave it out if there's no link). Add an optional `readme`
//  (content blocks, same format as blog posts) to control what
//  vim shows; otherwise it's generated from the fields below.
// ─────────────────────────────────────────────────────────────

import type { PostBlock } from "./posts";

export type Project = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  href?: string[];
  readme?: PostBlock[];
};

export const projects: Project[] = [
  {
    slug: "geospatial-mae",
    title: "Geospatial Masked Autoencoders",
    description:
      "Pretraining masked autoencoders on geospatial embeddings (TESSERA) in PyTorch, so downstream tasks perform better with less compute. My third-year dissertation, supervised by Prof. Srinivasan Keshav.",
    tags: ["PyTorch", "Machine Learning", "Computer Vision"],
    href: ["https://github.com/ZejiaYang/MAE_GeoTessera", "https://github.com/ucam-eo/tessera"],
  },
  {
    slug: "pcf-compiler",
    title: "PCF Compiler & Interpreter",
    description:
      "Interpreters (Call-by-Name/Value), de Bruijn translation, and a stack-machine compiler with type checking and inference for PCF. Caml doing OCaml stuff.",
    tags: ["OCaml", "compilers"],
    href: ["https://github.com/ZejiaYang/PCF-compiler-and-interpreter",],
  },
  {
    slug: "pillpall",
    title: "PillPall",
    description:
      "A medication reminder app that helps older adults take pills: Gemini AI verifies by voice and video. React + Flask.",
    tags: ["React", "Flask", "Gemini"],
  },
  {
    slug: "code-explain",
    title: "Code Explain AI Assistant",
    description:
      "A VS Code extension that explains unfamiliar codebases to the poor developer reading them. Second-year group project with an NVIDIA client.",
    tags: ["TypeScript", "VS Code", "LLM"],
  },
  {
    slug: "representation-control-survey",
    title: "Representation Control for LLMs: Survey & Research Challenges",
    description:
      "A survey on steering LLMs at the representation level. ACM Computing Surveys, 2026.",
    tags: ["publication", "ACM CSUR"],
    href: ["https://dl.acm.org/doi/10.1145/3846173",],
  },
  {
    slug: "lm-character-traits",
    title: "Evaluating Language Model Character Traits",
    description:
      "Do LLMs have stable character traits? There is a way to measure them. Findings of ACL: EMNLP, 2024.",
    tags: ["publication", "EMNLP Findings"],
    href: ["https://aclanthology.org/2024.findings-emnlp.77/",],
  },
];
