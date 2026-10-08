import type { Metadata } from "next";
import Terminal from "@/components/terminal/terminal";
import { dirSession } from "@/lib/shell/boot";

export const metadata: Metadata = {
  title: "Projects",
  description: "Things I've built.",
};

export default function ProjectsPage() {
  const { lines, cwd } = dirSession("project", new Date());
  return <Terminal key="projects" initialLines={lines} initialCwd={cwd} />;
}
