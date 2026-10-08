import { FASTFETCH_ART, fastfetchFacts } from "@/lib/shell/fastfetch";

/**
 * `fastfetch` output: a little CLI box on the left, facts on the
 * right. Plain divs with whitespace-pre (no <pre> quirks), flexbox
 * with wrap: the facts can never overlap the art; on narrow
 * screens they drop below it. Server-safe.
 */
export default function Fastfetch() {
  const facts = fastfetchFacts();
  return (
    <div className="my-1 flex flex-wrap items-center gap-x-6 gap-y-1 leading-[1.3]">
      <div
        aria-hidden="true"
        className="shrink-0 select-none whitespace-pre text-purple"
      >
        {FASTFETCH_ART.map((row, i) => (
          <div key={i}>{row}</div>
        ))}
      </div>
      <div className="min-w-0">
        {facts.map(([label, value], i) =>
          value ? (
            <div key={i}>
              <span className="text-cyan">{label}</span>
              <span>: {value}</span>
            </div>
          ) : (
            <div key={i} className={i === 0 ? "font-bold text-blue" : "text-blue"}>
              {label}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
