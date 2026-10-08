import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Terminal from "@/components/terminal/terminal";
import { allPosts, buildFs, getPost } from "@/lib/content";
import { site } from "@/lib/site";
import { withBasePath } from "@/lib/urls";
import { dirSession } from "@/lib/shell/boot";
import { nodeAt, stripContent } from "@/lib/shell/fs";

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams(): { slug: string }[] {
  const posts = allPosts();
  // This Next.js version rejects [] with output: export. The validation
  // placeholder is always a 404, never a post or a filesystem entry.
  return posts.length
    ? posts.map((post) => ({ slug: post.slug }))
    : [{ slug: "__empty" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug === "__empty") notFound();
  const post = getPost(slug);
  if (!post) notFound();
  const url = new URL(
    withBasePath(`/blog/${encodeURIComponent(post.slug)}/`),
    site.url,
  ).toString();
  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: site.name,
      title: `${post.title} · ${site.name}`,
      description: post.summary,
      publishedTime: `${post.date}T00:00:00.000Z`,
      authors: [site.name],
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  if (slug === "__empty") notFound();
  const root = buildFs();
  const path = ["home", "blog", `${slug}.md`];
  const file = nodeAt(root, path);
  if (!file || file.type !== "file" || !file.edLines) notFound();
  const { lines, cwd } = dirSession("blog", new Date(), root);
  return (
    <>
      <h1 className="sr-only">{file.title}</h1>
      <Terminal
        key={`post-${slug}`}
        root={stripContent(root)}
        initialLines={lines}
        initialCwd={cwd}
        initialEditor={{ path, file }}
      />
    </>
  );
}
