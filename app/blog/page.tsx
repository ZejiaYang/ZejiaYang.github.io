import type { Metadata } from "next";
import Terminal from "@/components/terminal/terminal";
import { buildFs } from "@/lib/content";
import { site } from "@/lib/site";
import { withBasePath } from "@/lib/urls";
import { dirSession } from "@/lib/shell/boot";
import { stripContent } from "@/lib/shell/fs";

const url = new URL(withBasePath("/blog/"), site.url).toString();
const description = "Notes and writing.";

export const metadata: Metadata = {
  title: "Blog",
  description,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: site.name,
    title: `Blog · ${site.name}`,
    description,
  },
};

export default function BlogPage() {
  const root = buildFs();
  const { lines, cwd } = dirSession("blog", new Date(), root);
  return (
    <Terminal
      key="blog"
      root={stripContent(root)}
      initialLines={lines}
      initialCwd={cwd}
    />
  );
}
