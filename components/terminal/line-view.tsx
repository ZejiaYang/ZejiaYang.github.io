import type { OutLine, Span, Tone } from "@/lib/shell/lines";

export const toneClass: Record<string, string | undefined> = {
  fg: undefined,
  muted: "text-muted",
  blue: "text-blue",
  cyan: "text-cyan",
  green: "text-green",
  orange: "text-orange",
  red: "text-red",
  purple: "text-purple",
};

function SpanView({
  span,
  toneMap,
}: {
  span: Span;
  toneMap?: Partial<Record<Tone, Tone>>;
}) {
  const tone = toneMap?.[span.tone ?? "fg"] ?? span.tone;
  const cls = [
    toneClass[tone ?? "fg"],
    span.bold ? "font-bold" : undefined,
    span.cmd ? "cursor-pointer hover:underline" : undefined,
    span.href ? "underline decoration-dotted underline-offset-4 hover:decoration-solid" : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  if (span.href) {
    return (
      <a className={cls} href={span.href} target="_blank" rel="noopener noreferrer">
        {span.text}
      </a>
    );
  }
  if (span.cmd) {
    // Click handling is delegated to the terminal container.
    return (
      <span className={cls} data-cmd={span.cmd} role="button" tabIndex={-1}>
        {span.text}
      </span>
    );
  }
  return <span className={cls}>{span.text}</span>;
}

/** One line of scrollback output. Server-safe: interactivity is
 *  via data attributes the client terminal listens for. `toneMap`
 *  remaps colors (the vim buffer uses it for its own colorscheme). */
export default function OutLineView({
  line,
  toneMap,
}: {
  line: OutLine;
  toneMap?: Partial<Record<Tone, Tone>>;
}) {
  if (line.spans.every((s) => !s.text)) {
    return <div aria-hidden="true">&nbsp;</div>;
  }
  return (
    <div
      className={`whitespace-pre-wrap break-words ${line.tight ? "leading-[1.25]" : ""}`}
    >
      {line.spans.map((span, i) => (
        <SpanView key={i} span={span} toneMap={toneMap} />
      ))}
    </div>
  );
}
