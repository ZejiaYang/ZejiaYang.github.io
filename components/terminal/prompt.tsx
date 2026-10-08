import { site } from "@/lib/site";
import { formatCwd } from "@/lib/shell/fs";

/** The prompt line, e.g. "guest@zejia ~ $". Shared by the live
 *  prompt and echoed commands in the scrollback. */
export default function Prompt({ cwd }: { cwd: string[] }) {
  return (
    <span aria-hidden="true">
      <span className="text-green">
        {site.shell.user}@{site.shell.host}
      </span>
      <span className="text-muted"> </span>
      <span className="text-blue">{formatCwd(cwd)}</span>
      <span className="text-muted"> $ </span>
    </span>
  );
}
