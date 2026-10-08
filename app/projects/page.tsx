import type { Metadata } from "next";
import Terminal from "@/components/terminal/terminal";
import { buildFs } from "@/lib/content";
import { site } from "@/lib/site";
import { withBasePath } from "@/lib/urls";
import { dirSession } from "@/lib/shell/boot";
import { stripContent } from "@/lib/shell/fs";

const url = new URL(withBasePath("/projects/"), site.url).toString();
const description = "Things I've built.";

export const metadata: Metadata = {
  title: "Projects",
  description,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: site.name,
    title: `Projects · ${site.name}`,
    description,
  },
};

export default function ProjectsPage() {
  const root = buildFs();
  const { lines, cwd } = dirSession("project", new Date(), root);
  return (
    <Terminal
      key="projects"
      root={stripContent(root)}
      initialLines={lines}
      initialCwd={cwd}
    />
  );
}
