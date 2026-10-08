"use client";

import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { site } from "@/lib/site";
import { publishMeter, type MeterKind } from "@/lib/telemetry";
import { formatDate } from "@/lib/date";
import type { FsFile } from "@/lib/shell/fs";
import { getShortcut } from "@/lib/shell/commands";
import { dayOfYear } from "@/lib/shell/calendar";

function Section({ cmd, children }: { cmd: string; children: ReactNode }) {
  return (
    <section>
      <div className="text-muted">
        <span className="select-none text-green">$</span>{" "}
        <button
          type="button"
          data-cmd={cmd}
          className="command-button hover:text-fg"
        >
          {cmd}
        </button>
      </div>
      <div className="mt-1">{children}</div>
    </section>
  );
}

/** Digital clock + sentence for the day. Mount-gated so the
 *  prerendered HTML doesn't bake in the build-time date. */
function ClockNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timeout = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  if (!now) {
    return (
      <div className="mt-1 text-lg font-bold tabular-nums text-muted">
        --:--:--
      </div>
    );
  }

  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const fortune = site.fortunes[dayOfYear(now) % site.fortunes.length];

  return (
    <>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums">
          {now.toLocaleTimeString("en-GB")}
        </span>
        <span className="text-muted">{dateLabel}</span>
      </div>
      <p className="mt-1 text-muted">&quot;{fortune}&quot;</p>
    </>
  );
}

type MeterColor = "blue" | "orange" | "purple" | "green";

// Identity stays with the label, not its current position or animated value.
const MOOD_STYLE: Record<string, { color: MeterColor; duration: number }> = {
  energy: { color: "blue", duration: 3.1 },
  caffeine: { color: "orange", duration: 4.3 },
  vibe: { color: "purple", duration: 5.7 },
};
const SKILL_DURATIONS = [2.8, 3.7, 4.9, 6.1];

/** Playful ambient telemetry, not a proficiency rating. Each meter owns
 *  its small timer; fill, visible percentage and accessible value agree. */
function Meter({
  kind,
  label,
  min,
  max,
  duration,
  color,
}: {
  kind: MeterKind;
  label: string;
  min: number;
  max: number;
  duration: number;
  color: MeterColor;
}) {
  const [percent, setPercent] = useState(() => Math.round(max * 100));

  useLayoutEffect(() => {
    publishMeter(kind, label, percent);
  }, [kind, label, percent]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | null = null;
    let elapsed = 0;
    let started = 0;

    function tick() {
      const phase = (elapsed + performance.now() - started) / (duration * 1000);
      const value = min + ((max - min) * (1 + Math.cos(phase * Math.PI))) / 2;
      setPercent(Math.round(value * 100));
    }

    function start() {
      if (timer !== null || reducedMotion.matches || document.hidden) return;
      started = performance.now();
      timer = setInterval(tick, 120);
    }

    function stop() {
      if (timer === null) return;
      elapsed += performance.now() - started;
      clearInterval(timer);
      timer = null;
    }

    function onMotionChange() {
      stop();
      if (reducedMotion.matches) {
        elapsed = 0;
        setPercent(Math.round(max * 100));
      } else {
        start();
      }
    }

    function onVisibilityChange() {
      if (document.hidden) stop();
      else start();
    }

    start();
    reducedMotion.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      reducedMotion.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [min, max, duration]);

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent} percent, ambient animation, not a rating`}
      title={`${label}: ${percent}%, ambient animation, not a rating`}
      style={{ "--meter-color": `var(--meter-${color})` } as CSSProperties}
    >
      <div className="flex justify-between gap-2 text-muted" aria-hidden="true">
        <span>{label}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div className="meter-track mt-0.5" aria-hidden="true">
        <div className="meter-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

type Props = {
  onFold: () => void;
  /** Supplied by the shell filesystem; no post corpus enters this module. */
  posts: FsFile[];
  emptyBlogNote?: string;
};

/**
 * The right-hand tmux pane: an always-on dashboard. Clock and the
 * sentence of the day sit fixed on top; everything else scrolls.
 * Every section header is a native, keyboard-activatable command.
 */
export default function Dashboard({ onFold, posts, emptyBlogNote }: Props) {
  const recent = [...posts]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 3);

  return (
    <div className="flex h-full flex-col text-[12px] leading-relaxed">
      <div className="shrink-0 border-b border-line px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="text-muted">
            <span className="select-none text-green">$</span>{" "}
            <button
              type="button"
              data-cmd={getShortcut("date").command}
              className="command-button hover:text-fg"
            >
              date
            </button>
            {" && "}
            <button
              type="button"
              data-cmd={getShortcut("fortune").command}
              className="command-button hover:text-fg"
            >
              fortune
            </button>
          </div>
          <button
            type="button"
            onClick={onFold}
            aria-label="fold dashboard pane"
            title="fold pane (reopen via [1:dash] below)"
            className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:bg-line/60 hover:text-fg"
          >
            ×
          </button>
        </div>
        <ClockNow />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <Section cmd={getShortcut("mood").command}>
          <div className="space-y-1.5">
            {site.mood.map((meter) => (
              <Meter
                key={meter.label}
                kind="mood"
                label={meter.label}
                min={meter.min}
                max={meter.max}
                duration={MOOD_STYLE[meter.label]?.duration ?? 4}
                color={MOOD_STYLE[meter.label]?.color ?? "blue"}
              />
            ))}
          </div>
        </Section>

        <Section cmd={getShortcut("now").command}>
          <p>{site.now}</p>
        </Section>

        <Section cmd={getShortcut("skills").command}>
          <div className="space-y-1.5">
            {site.skills.map((skill, i) => (
              <Meter
                key={skill.label}
                kind="skills"
                label={skill.label}
                min={skill.min}
                max={skill.max}
                duration={SKILL_DURATIONS[i % SKILL_DURATIONS.length]}
                color="green"
              />
            ))}
          </div>
        </Section>

        <Section cmd={getShortcut("blog").command}>
          <ul>
            {recent.length === 0 && emptyBlogNote && (
              <li className="text-muted">{emptyBlogNote}</li>
            )}
            {recent.map((post) => (
              <li key={post.name}>
                <button
                  type="button"
                  data-cmd={`vim ${JSON.stringify(`~/blog/${post.name}`)}`}
                  className="command-button text-cyan hover:underline"
                >
                  {post.title ?? post.name}
                </button>
                {post.date && (
                  <span className="text-muted"> · {formatDate(post.date)}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section cmd={getShortcut("elsewhere").command}>
          <ul>
            {site.socials.map((social) => (
              <li key={social.label}>
                {social.href ? (
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan underline decoration-dotted underline-offset-4 hover:decoration-solid"
                  >
                    {social.label}
                  </a>
                ) : (
                  <span>{social.label}</span>
                )}
                <span className="text-muted">: {social.handle}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
