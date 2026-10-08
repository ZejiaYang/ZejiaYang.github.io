// Builders that turn site content into the "markdown source" shown
// when a file is printed (cat) or opened (vim). Lines look like raw
// markdown, tinted with terminal colors.

import { site } from "@/lib/site";
import type { Project } from "@/lib/projects";
import type { Post, PostBlock } from "@/lib/posts";
import type { LikeCategory } from "@/lib/likes";
import { out, blank, text, type OutLine, type Span } from "./lines";

function blocksToLines(blocks: PostBlock[]): OutLine[] {
  const lines: OutLine[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "h2":
        lines.push(out({ text: `## ${block.text}`, tone: "blue", bold: true }));
        break;
      case "quote":
        lines.push(text(`> ${block.text}`, "muted"));
        break;
      case "list":
        for (const item of block.items) {
          lines.push(out({ text: "- ", tone: "orange" }, { text: item }));
        }
        break;
      case "code": {
        lines.push(text("```" + (block.lang ?? ""), "muted"));
        for (const codeLine of block.code.split("\n")) {
          lines.push(text(codeLine, "green"));
        }
        lines.push(text("```", "muted"));
        break;
      }
      default:
        lines.push(text(block.text));
    }
    lines.push(blank());
  }
  // Trim trailing blank line.
  while (lines.length > 0 && lines[lines.length - 1].spans.every((s) => !s.text)) {
    lines.pop();
  }
  return lines;
}

function header(title: string): OutLine[] {
  return [out({ text: `# ${title}`, tone: "blue", bold: true }), blank()];
}

export function aboutFile(): OutLine[] {
  const lines = header(site.name);
  for (const paragraph of site.bio) {
    lines.push(text(paragraph), blank());
  }

  lines.push(out({ text: "## experience", tone: "blue", bold: true }));
  for (const job of site.experience) {
    lines.push(
      out(
        { text: "- ", tone: "orange" },
        { text: `${job.org}, ${job.role}`, bold: true },
        { text: `  (${job.when})`, tone: "muted" },
      ),
      out({ text: "  " }, { text: job.what }),
      out(
        { text: "  " },
        { text: "How: ", tone: "muted" },
        { text: job.how },
      ),
    );
  }

  lines.push(blank(), out({ text: "## education", tone: "blue", bold: true }));
  for (const entry of site.education) {
    lines.push(out({ text: "- ", tone: "orange" }, { text: entry }));
  }

  lines.push(blank(), out({ text: "## elsewhere", tone: "blue", bold: true }));
  for (const social of site.socials) {
    lines.push(
      out(
        { text: "- ", tone: "orange" },
        social.href
          ? { text: social.label, tone: "cyan" as const, href: social.href }
          : { text: social.label },
        { text: `: ${social.handle}`, tone: "muted" },
      ),
    );
  }
  return lines;
}

export function nowFile(): OutLine[] {
  const lines = header("now");
  lines.push(text(site.now));
  return lines;
}

export function elsewhereFile(): OutLine[] {
  const lines = header("elsewhere");
  for (const social of site.socials) {
    lines.push(
      out(
        { text: "- ", tone: "orange" },
        social.href
          ? { text: social.label, tone: "cyan" as const, href: social.href }
          : { text: social.label },
        { text: `: ${social.handle}`, tone: "muted" },
      ),
    );
  }
  return lines;
}

export function projectFile(project: Project): OutLine[] {
  if (project.readme) return blocksToLines(project.readme);
  const lines = header(project.title);
  lines.push(text(project.description), blank());
  lines.push(out({ text: "## stack", tone: "blue", bold: true }));
  for (const tag of project.tags) {
    lines.push(out({ text: "- ", tone: "orange" }, { text: tag }));
  }
  if (project.href) {
    lines.push(
      blank(),
      out({ text: "## links", tone: "blue", bold: true }),
    );
    for (const link of project.href) {
      lines.push(out(
        { text: "- ", tone: "orange" },
        { text: link, tone: "cyan", href: link },
      ));
    }
  }
  return lines;
}

export function postFile(post: Post): OutLine[] {
  return blocksToLines(post.blocks);
}

export function likeFile(category: LikeCategory): OutLine[] {
  const lines = header(category.title);
  if (category.blurb) lines.push(text(category.blurb, "muted"), blank());
  for (const item of category.items) {
    const spans: Span[] = [
      { text: "- ", tone: "orange" },
      item.href
        ? { text: item.name, tone: "cyan", href: item.href }
        : { text: item.name },
    ];
    if (item.note) spans.push({ text: `: ${item.note}`, tone: "muted" });
    lines.push(out(...spans));
  }
  return lines;
}
