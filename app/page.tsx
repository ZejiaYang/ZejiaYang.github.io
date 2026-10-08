import type { Metadata } from "next";
import Terminal from "@/components/terminal/terminal";
import { buildFs } from "@/lib/content";
import { site } from "@/lib/site";
import { withBasePath } from "@/lib/urls";
import { bootSession } from "@/lib/shell/boot";
import { stripContent } from "@/lib/shell/fs";

const url = new URL(withBasePath("/"), site.url).toString();

export const metadata: Metadata = {
  title: { absolute: site.name },
  description: site.tagline,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: site.name,
    title: site.name,
    description: site.tagline,
  },
};

export default function Home() {
  const root = buildFs();
  const { lines, cwd } = bootSession(new Date(), root);
  return (
    <Terminal
      key="home"
      root={stripContent(root)}
      initialLines={lines}
      initialCwd={cwd}
    />
  );
}
