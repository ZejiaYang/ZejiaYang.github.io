import type { MetadataRoute } from "next";
import { allPosts, allProjects } from "@/lib/content";
import { site } from "@/lib/site";
import { withBasePath } from "@/lib/urls";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/projects/",
    "/blog/",
    ...allProjects().map(
      (project) => `/projects/${encodeURIComponent(project.slug)}/`,
    ),
    ...allPosts().map((post) => `/blog/${encodeURIComponent(post.slug)}/`),
  ];
  return paths.map((path) => ({
    url: new URL(withBasePath(path), site.url).href,
  }));
}
