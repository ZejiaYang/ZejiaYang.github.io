// Calendar and day-of-year helpers for the `cal` / `fortune`
// commands and the dashboard's fixed date section.

import { out, text, type OutLine, type Span } from "./lines";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEK_HEADER = "Su Mo Tu We Th Fr Sa";
const CAL_W = WEEK_HEADER.length; // 20

export function dayOfYear(d: Date): number {
  const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const start = Date.UTC(d.getFullYear(), 0, 0);
  return Math.floor((today - start) / 86_400_000);
}

/** `cal`-style month grid with today highlighted. */
export function calendarLines(now: Date): OutLine[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const title = `${MONTHS[month]} ${year}`;
  const lines: OutLine[] = [
    text(" ".repeat(Math.floor((CAL_W - title.length) / 2)) + title),
    text(WEEK_HEADER, "muted"),
  ];

  // Cells of 2 chars, single-space separated; leading blanks for week 1.
  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  for (let w = 0; w < cells.length; w += 7) {
    const week = cells.slice(w, w + 7);
    const spans: Span[] = [];
    week.forEach((day, i) => {
      if (i > 0) spans.push({ text: " " });
      if (day === null) {
        spans.push({ text: "  " });
      } else {
        const isToday = day === today;
        spans.push({
          text: String(day).padStart(2),
          tone: isToday ? "orange" : undefined,
          bold: isToday,
        });
      }
    });
    lines.push(out(...spans));
  }
  return lines;
}
