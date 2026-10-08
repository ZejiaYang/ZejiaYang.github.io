import { buildFs, contentFiles } from "@/lib/content";
import { nodeAt } from "@/lib/shell/fs";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { path: string[] }[] {
  return contentFiles(buildFs()).map(({ path }) => ({
    path: [...path.slice(0, -1), `${path[path.length - 1]}.json`],
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const filename = path[path.length - 1];
  if (!filename?.endsWith(".json")) {
    return Response.json({ lines: [] }, { status: 404 });
  }
  const filePath = [...path.slice(0, -1), filename.slice(0, -5)];
  const file = nodeAt(buildFs(), filePath);
  if (!file || file.type !== "file" || !file.edLines) {
    return Response.json({ lines: [] }, { status: 404 });
  }
  return Response.json({ lines: file.edLines });
}
