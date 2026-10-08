import type { Metadata } from "next";
import Terminal from "@/components/terminal/terminal";
import { dirSession } from "@/lib/shell/boot";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes and writing.",
};

export default function BlogPage() {
  const { lines, cwd } = dirSession("blog", new Date());
  return <Terminal key="blog" initialLines={lines} initialCwd={cwd} />;
}
