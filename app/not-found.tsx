import Link from "next/link";
import Prompt from "@/components/terminal/prompt";
import OutLineView from "@/components/terminal/line-view";
import { site } from "@/lib/site";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-base sm:rounded-xl sm:border sm:border-line">
      <div className="relative flex items-center border-b border-line bg-mantle px-3 py-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-red/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-orange/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green/70" />
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-[11px] text-muted">
          {site.shell.user}@{site.shell.host}: ~
        </span>
      </div>

      <div className="flex-1 px-3 pt-3 sm:px-4">
        <div>
          <Prompt cwd={["home"]} />
          <span>cd /nowhere</span>
        </div>
        <OutLineView
          line={{
            spans: [
              {
                text: "cd: no such file or directory: /nowhere (404)",
                tone: "red",
              },
            ],
          }}
        />
        <OutLineView line={{ spans: [{ text: "" }] }} />
        <div>
          <Prompt cwd={["home"]} />
          <Link href="/" className="text-cyan hover:underline">
            cd ~
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line bg-mantle px-3 py-1.5 text-[11px] text-muted">
        <span aria-hidden="true">
          <span className="font-bold text-green">[main]</span> zsh
        </span>
      </div>
    </div>
  );
}
