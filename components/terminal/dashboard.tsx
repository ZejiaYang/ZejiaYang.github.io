"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { allPosts, blogEmptyNote, formatDate } from "@/lib/posts";
import { dayOfYear } from "@/lib/shell/calendar";

function Section({
  cmd,
  children,
}: {
  cmd: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="select-none text-muted">
        <span className="text-green">$</span>{" "}
        <span
          data-cmd={cmd}
          role="button"
          tabIndex={-1}
          className="cursor-pointer hover:text-fg"
        >
          {cmd}
        </span>
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

/** Ambient htop-style bar. Pure ambience: the number is meaningless. */
const MOOD_COLORS = ["bg-blue", "bg-orange", "bg-purple"];
const MOOD_DURATIONS = [3.1, 4.3, 5.7];
const SKILL_DURATIONS = [2.8, 3.7, 4.9, 6.1];

function AmbientBar({
  label,
  min,
  max,
  duration,
  color,
}: {
  label: string;
  min: number;
  max: number;
  duration: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between">
        <span className="text-muted">{label}</span>
        <span className="text-muted">{Math.round(max * 100)}%</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-sm bg-line/60">
        <div
          className={`dash-bar h-full ${color}`}
          style={
            {
              "--min": min,
              "--max": max,
              animationDuration: `${duration}s`,
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
}

/**
 * The right-hand tmux pane: an always-on dashboard. Clock and the
 * sentence of the day sit fixed on top; everything else scrolls.
 * Every section header is a real, clickable command. The pane can
 * be folded away via the × button or the [1:dash] status-bar tab.
 */
export default function Dashboard({ onFold }: { onFold: () => void }) {
  const recent = allPosts().slice(0, 3);

  return (
    <div className="flex h-full flex-col text-[12px] leading-relaxed">
      {/* fixed top: digital clock + sentence for the day */}
      <div className="shrink-0 border-b border-line px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="select-none text-muted">
            <span className="text-green">$</span>{" "}
            <span data-cmd="date" role="button" tabIndex={-1} className="cursor-pointer hover:text-fg">
              date
            </span>
            {" && "}
            <span data-cmd="fortune" role="button" tabIndex={-1} className="cursor-pointer hover:text-fg">
              fortune
            </span>
          </div>
          <button
            type="button"
            onClick={onFold}
            aria-label="fold dashboard pane"
            title="fold pane (reopen via [1:dash] below)"
            className="-mr-1 -mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-line/60 hover:text-fg"
          >
            ×
          </button>
        </div>
        <ClockNow />
      </div>

      {/* scrollable sections */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <Section cmd="mood">
          <div className="space-y-1.5">
            {site.mood.map((meter, i) => (
              <AmbientBar
                key={meter.label}
                label={meter.label}
                min={meter.min}
                max={meter.max}
                duration={MOOD_DURATIONS[i % MOOD_DURATIONS.length]}
                color={MOOD_COLORS[i % MOOD_COLORS.length]}
              />
            ))}
          </div>
        </Section>

        <Section cmd="cat now.txt">
          <p>{site.now}</p>
        </Section>

        <Section cmd="skills --usage">
          <div className="space-y-1.5">
            {site.skills.map((skill, i) => (
              <AmbientBar
                key={skill.label}
                label={skill.label}
                min={skill.min}
                max={skill.max}
                duration={SKILL_DURATIONS[i % SKILL_DURATIONS.length]}
                color="bg-green"
              />
            ))}
          </div>
        </Section>

        <Section cmd="ls ~/blog">
          <ul>
            {recent.length === 0 && (
              <li className="text-muted">{blogEmptyNote}</li>
            )}
            {recent.map((post) => (
              <li key={post.slug} className="truncate">
                <span
                  data-cmd={`vim ~/blog/${post.slug}.md`}
                  role="button"
                  tabIndex={-1}
                  className="cursor-pointer text-cyan hover:underline"
                >
                  {post.title}
                </span>
                <span className="text-muted"> · {formatDate(post.date)}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section cmd="cat elsewhere.txt">
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
