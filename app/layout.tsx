import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { site } from "@/lib/site";

// Locally bundled full JetBrains Mono (app/fonts/): NOT the
// Google Fonts subset, which omits box-drawing/block glyphs and
// breaks terminal art on systems where they fall back to CJK fonts.
const jetbrainsMono = localFont({
  src: [
    { path: "./fonts/JetBrainsMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/JetBrainsMono-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-jbmono",
});

// Runs before first paint so the correct theme is applied with no flash.
const themeInit = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){document.documentElement.classList.add("dark");}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.tagline,
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: site.name,
    description: site.tagline,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jetbrainsMono.variable} antialiased`}
    >
      <body className="h-dvh overflow-hidden bg-base font-mono text-[13px] text-fg sm:text-sm">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <main className="h-full sm:p-4">{children}</main>
      </body>
    </html>
  );
}
