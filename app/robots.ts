import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { withBasePath } from "@/lib/urls";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: withBasePath("/content/") },
    sitemap: new URL(withBasePath("/sitemap.xml"), site.url).href,
  };
}
