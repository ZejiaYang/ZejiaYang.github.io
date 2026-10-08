import { site } from "@/lib/site";
import { GHOST, type ArtFrame } from "@/lib/shell/art";
import { getQuickCommands } from "@/lib/shell/commands";
import { toneClass } from "./line-view";

function GhostFrame({ frame }: { frame: ArtFrame }) {
  return (
    <pre aria-hidden="true" className="text-[13px] leading-[1.2]">
      {frame.map((row, i) => (
        <div key={i}>
          {row.map((seg, j) => (
            <span key={j} className={toneClass[seg.tone ?? "fg"]}>
              {seg.text}
            </span>
          ))}
        </div>
      ))}
    </pre>
  );
}

/**
 * The boot banner: a bordered box with a floating, blinking ghost
 * and a clickable command list. Flexbox layout: side by side when
 * there's room, stacked when there isn't, at any aspect ratio.
 * Server-safe: commands run via the terminal's click delegation.
 */
export default function Banner() {
  return (
    <div className="relative mx-auto mb-1 mt-3 w-fit max-w-full border border-line px-5 pb-3 pt-4 sm:px-7">
      <span className="absolute -top-[0.65em] left-1/2 -translate-x-1/2 select-none whitespace-nowrap bg-base px-1 text-muted">
        ─ welcome ─
      </span>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-7">
        {/* the ghost wanders inside a fixed playground, centered;
            two blink frames fade in over the open-eyes base frame */}
        <div className="w-[15ch] shrink-0 select-none px-2 py-2">
          <div className="ghost-float relative mx-auto w-fit">
            <GhostFrame frame={GHOST[0]} />
            <div className="ghost-half absolute inset-0">
              <GhostFrame frame={GHOST[1]} />
            </div>
            <div className="ghost-closed absolute inset-0">
              <GhostFrame frame={GHOST[2]} />
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="font-bold text-blue">
            {site.shell.user}@{site.shell.host}
          </div>
          <div className="select-none text-muted" aria-hidden="true">
            ─────────────
          </div>
          <ul className="mt-1 space-y-0.5">
            {getQuickCommands().map(({ id, command, description }) => (
              <li
                key={id}
                className="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-3"
              >
                <button
                  type="button"
                  data-cmd={command}
                  className="command-button whitespace-nowrap text-cyan hover:underline"
                >
                  {command}
                </button>
                <span className="min-w-0 max-w-[28ch] text-muted">
                  # {description}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-green"># click, or type below</div>
        </div>
      </div>
    </div>
  );
}
