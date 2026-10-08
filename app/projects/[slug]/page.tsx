import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Terminal from "@/components/terminal/terminal";
import { allProjects, buildFs, getProject } from "@/lib/content";
import { site } from "@/lib/site";
import { withBasePath } from "@/lib/urls";
import { dirSession } from "@/lib/shell/boot";
import { nodeAt, stripContent } from "@/lib/shell/fs";

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams(): { slug: string }[] {
  return allProjects().map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  const url = new URL(
    withBasePath(`/projects/${encodeURIComponent(project.slug)}/`),
    site.url,
  ).toString();
  return {
    title: project.title,
    description: project.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: site.name,
      title: `${project.title} · ${site.name}`,
      description: project.description,
    },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const root = buildFs();
  const path = ["home", "project", `${slug}.md`];
  const file = nodeAt(root, path);
  if (!file || file.type !== "file" || !file.edLines) notFound();
  const { lines, cwd } = dirSession("project", new Date(), root);
  return (
    <>
      <h1 className="sr-only">{file.title}</h1>
      <Terminal
        key={`project-${slug}`}
        root={stripContent(root)}
        initialLines={lines}
        initialCwd={cwd}
        initialEditor={{ path, file }}
      />
    </>
  );
}
