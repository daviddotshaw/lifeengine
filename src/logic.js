/* ------------------------------------------------------------
   Pure date / streak / metrics logic. No React, no storage —
   everything here is unit-tested in logic.test.js. Extracted
   from App.jsx so the subtle date math has a safety net.
   ------------------------------------------------------------ */

/* ---------------- date & period helpers ---------------- */
export const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};
export const todayKey = () => dayKey(Date.now());
export const daysAgoKey = (n) => dayKey(Date.now() - n * 86400000);
export const weekdayShort = (n) =>
  new Date(Date.now() - n * 86400000).toLocaleDateString(undefined, {
    weekday: "short",
  });

export const isoWeekKey = (ts) => {
  const d = new Date(ts);
  const th = new Date(d);
  th.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3); // Thursday of this week
  const year = th.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week =
    1 + Math.round(((th - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${year}-W${week}`;
};
export const monthKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
};
/** Current period key for a repeat cadence; null for one-off tasks. */
export const periodKey = (repeat, ts = Date.now()) =>
  repeat === "daily"
    ? dayKey(ts)
    : repeat === "weekly"
    ? isoWeekKey(ts)
    : repeat === "monthly"
    ? monthKey(ts)
    : null;

export const REPEATS = [
  { id: null, label: "Once" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

/* ---------------- streak freezes ---------------- */
/* Tokens auto-spent to bridge missed days so the streak survives.
   One is earned at every 7-day streak milestone, capped at FREEZE_CAP. */
export const FREEZE_CAP = 3;

/**
 * Which past days should freeze tokens be spent on, walking back from
 * yesterday? Returns the dayKeys to freeze — or [] when the gap can't be
 * fully covered or there's no streak behind it (tokens are never wasted
 * on an already-broken streak). Today is never frozen: the streak
 * survives until the day ends.
 */
export function planFreezeSpend(log, frozenDays, freezes) {
  const days = new Set(log.map((e) => dayKey(e.completedAt)));
  frozenDays.forEach((d) => days.add(d));
  if (days.size === 0) return [];
  const missing = [];
  let anchored = false;
  for (let i = 1; missing.length <= freezes; i++) {
    const key = daysAgoKey(i);
    if (days.has(key)) {
      anchored = true;
      break;
    }
    missing.push(key);
  }
  return anchored && missing.length > 0 && missing.length <= freezes ? missing : [];
}

/* ---------------- derived metrics ---------------- */
export function computeStreak(log, frozenDays = []) {
  const days = new Set(log.map((e) => dayKey(e.completedAt)));
  frozenDays.forEach((d) => days.add(d));
  let streak = 0;
  let i = days.has(todayKey()) ? 0 : 1; // streak survives until today ends
  if (i === 1 && !days.has(daysAgoKey(1))) return 0;
  for (; ; i++) {
    if (days.has(daysAgoKey(i))) streak++;
    else break;
  }
  return streak;
}

export function computeVelocity(log) {
  const today = log.filter((e) => dayKey(e.completedAt) === todayKey()).length;
  const week = log.filter((e) => e.completedAt > Date.now() - 7 * 86400000).length;
  return { today, avg: Math.round((week / 7) * 10) / 10 };
}

/* ---------------- levels ---------------- */
/* Quadratic curve: level n needs 50*(n-1)^2 total XP. With XP awards of
   10/25/50/100 per task, level 2 (50 XP) is a handful of tasks, level 5
   (800 XP) is weeks of consistent use, level 10 (4050 XP) is a long-term
   goal — titles run out at LEVEL_TITLES.length and just show "Lv. N". */
export const LEVEL_TITLES = [
  "Newcomer",
  "Habit Starter",
  "Steady Climber",
  "Momentum Builder",
  "Consistency Machine",
  "Focused",
  "Relentless",
  "Habit Machine",
  "Unstoppable",
  "Living Legend",
];

export function xpForLevel(level) {
  return level <= 1 ? 0 : 50 * (level - 1) * (level - 1);
}

export function levelForXp(xp) {
  // +1e-9 guards against float rounding landing just under an exact boundary
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50) + 1e-9) + 1;
}

export function levelTitle(level) {
  return LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1];
}

/** Everything a level display needs, derived from total XP. */
export function levelInfo(xp) {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = nextLevelXp - floor;
  const into = xp - floor;
  return {
    level,
    title: levelTitle(level),
    floor,
    nextLevelXp,
    into,
    span,
    pct: span > 0 ? Math.min(1, into / span) : 1,
  };
}

export function weekSeries(log, frozenDays = []) {
  const out = [];
  for (let n = 6; n >= 0; n--) {
    const key = daysAgoKey(n);
    const entries = log.filter((e) => dayKey(e.completedAt) === key);
    out.push({
      label: n === 0 ? "Today" : weekdayShort(n),
      count: entries.length,
      xp: entries.reduce((s, e) => s + e.xp, 0),
      frozen: frozenDays.includes(key),
    });
  }
  return out;
}
