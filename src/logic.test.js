import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  dayKey,
  todayKey,
  daysAgoKey,
  isoWeekKey,
  monthKey,
  periodKey,
  computeStreak,
  computeVelocity,
  weekSeries,
  planFreezeSpend,
  xpForLevel,
  levelForXp,
  levelInfo,
  LEVEL_TITLES,
} from "./logic.js";
import { collector } from "./flavors/collector.jsx";

const DAY = 86400000;
/* a completion n whole days ago (noon-anchored via fake time below) */
const entry = (n, xp = 10) => ({ id: `e${n}`, xp, completedAt: Date.now() - n * DAY });

beforeEach(() => {
  vi.useFakeTimers();
  /* fixed local noon on a Monday, away from midnight/DST edges */
  vi.setSystemTime(new Date(2026, 6, 6, 12, 0, 0)); // Mon 6 Jul 2026
});
afterEach(() => vi.useRealTimers());

describe("date helpers", () => {
  it("dayKey formats zero-padded local dates", () => {
    expect(dayKey(Date.now())).toBe("2026-07-06");
    expect(todayKey()).toBe("2026-07-06");
    expect(daysAgoKey(0)).toBe(todayKey());
    expect(daysAgoKey(6)).toBe("2026-06-30");
  });

  it("isoWeekKey groups Mon-Sun together and splits at the week boundary", () => {
    const mon = new Date(2026, 6, 6).getTime();
    const sun = new Date(2026, 6, 12).getTime();
    const prevSun = new Date(2026, 6, 5).getTime();
    expect(isoWeekKey(mon)).toBe(isoWeekKey(sun));
    expect(isoWeekKey(prevSun)).not.toBe(isoWeekKey(mon));
  });

  it("periodKey maps cadences and is null for one-offs", () => {
    expect(periodKey("daily")).toBe("2026-07-06");
    expect(periodKey("weekly")).toBe(isoWeekKey(Date.now()));
    expect(periodKey("monthly")).toBe(monthKey(Date.now()));
    expect(periodKey(null)).toBeNull();
  });
});

describe("computeStreak", () => {
  it("is 0 with no completions", () => {
    expect(computeStreak([])).toBe(0);
  });

  it("counts today", () => {
    expect(computeStreak([entry(0)])).toBe(1);
  });

  it("survives until today ends when yesterday was done", () => {
    expect(computeStreak([entry(1)])).toBe(1);
  });

  it("breaks after a missed day", () => {
    expect(computeStreak([entry(2)])).toBe(0);
  });

  it("counts consecutive days", () => {
    expect(computeStreak([entry(0), entry(1), entry(2)])).toBe(3);
  });

  it("treats frozen days as streak days", () => {
    expect(computeStreak([entry(2)], [daysAgoKey(1)])).toBe(2);
    expect(computeStreak([entry(0), entry(3)], [daysAgoKey(1), daysAgoKey(2)])).toBe(4);
  });
});

describe("planFreezeSpend", () => {
  it("bridges a one-day gap with one token", () => {
    expect(planFreezeSpend([entry(2)], [], 1)).toEqual([daysAgoKey(1)]);
  });

  it("never spends on an uncoverable gap", () => {
    expect(planFreezeSpend([entry(3)], [], 1)).toEqual([]);
  });

  it("bridges a two-day gap with two tokens, oldest anchor intact", () => {
    expect(planFreezeSpend([entry(3)], [], 2)).toEqual([daysAgoKey(1), daysAgoKey(2)]);
  });

  it("spends nothing when the chain is intact", () => {
    expect(planFreezeSpend([entry(0)], [], 3)).toEqual([]);
    expect(planFreezeSpend([entry(1)], [], 3)).toEqual([]);
  });

  it("spends nothing with an empty history or zero tokens", () => {
    expect(planFreezeSpend([], [], 3)).toEqual([]);
    expect(planFreezeSpend([entry(2)], [], 0)).toEqual([]);
  });

  it("counts already-frozen days as covered", () => {
    expect(planFreezeSpend([entry(2)], [daysAgoKey(1)], 3)).toEqual([]);
  });
});

describe("metrics", () => {
  it("computeVelocity splits today vs 7-day average", () => {
    const v = computeVelocity([entry(0), entry(0), entry(1), entry(10)]);
    expect(v.today).toBe(2);
    expect(v.avg).toBe(Math.round((3 / 7) * 10) / 10);
  });

  it("weekSeries returns 7 days with counts, xp and frozen flags", () => {
    const s = weekSeries([entry(0, 25), entry(1, 10)], [daysAgoKey(2)]);
    expect(s).toHaveLength(7);
    expect(s[6]).toMatchObject({ label: "Today", count: 1, xp: 25, frozen: false });
    expect(s[5].count).toBe(1);
    expect(s[4].frozen).toBe(true);
    expect(s[0].count).toBe(0);
  });
});

describe("levels", () => {
  it("starts at level 1 with zero XP", () => {
    expect(levelForXp(0)).toBe(1);
    expect(xpForLevel(1)).toBe(0);
  });

  it("levels up exactly at each threshold, not before", () => {
    expect(levelForXp(49)).toBe(1);
    expect(levelForXp(50)).toBe(2);
    expect(levelForXp(199)).toBe(2);
    expect(levelForXp(200)).toBe(3);
    expect(levelForXp(449)).toBe(3);
    expect(levelForXp(450)).toBe(4);
  });

  it("xpForLevel and levelForXp round-trip at exact boundaries", () => {
    for (let lvl = 1; lvl <= 30; lvl++) {
      expect(levelForXp(xpForLevel(lvl))).toBe(lvl);
    }
  });

  it("is monotonic non-decreasing as xp grows", () => {
    let prev = levelForXp(0);
    for (let xp = 0; xp <= 5000; xp += 37) {
      const lvl = levelForXp(xp);
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    }
  });

  it("levelInfo reports a sane progress fraction that never exceeds 1", () => {
    const info = levelInfo(120);
    expect(info.level).toBe(2);
    expect(info.into).toBe(120 - xpForLevel(2));
    expect(info.span).toBe(xpForLevel(3) - xpForLevel(2));
    expect(info.pct).toBeGreaterThanOrEqual(0);
    expect(info.pct).toBeLessThanOrEqual(1);
  });

  it("falls back to the last title once past the named ladder", () => {
    const highLevel = LEVEL_TITLES.length + 5;
    const info = levelInfo(xpForLevel(highLevel));
    expect(info.title).toBe(LEVEL_TITLES[LEVEL_TITLES.length - 1]);
  });
});

describe("collector lucky rolls", () => {
  const gen = collector.reward.generate;

  it("flags every 11th catch as lucky", () => {
    expect(gen({}, { count: 0 }).lucky).toBe(false);
    expect(gen({}, { count: 9 }).lucky).toBe(false);
    expect(gen({}, { count: 10 }).lucky).toBe(true);
    expect(gen({}, { count: 11 }).lucky).toBe(false);
    expect(gen({}, { count: 21 }).lucky).toBe(true);
  });

  it("always rolls valid stat values", () => {
    const sizes = ["Tiny", "XS", "S", "Average", "L", "XL", "Huge"];
    const lusters = ["porous", "silky", "pearly", "adamant"];
    const strengths = ["weakest", "weak", "average", "strong", "strongest"];
    for (let i = 0; i < 200; i++) {
      const d = gen({}, { count: i });
      expect(sizes).toContain(d.size);
      expect(lusters).toContain(d.luster);
      expect(strengths).toContain(d.strength);
      expect(d.weight).toBeGreaterThanOrEqual(1);
      expect(d.weight).toBeLessThanOrEqual(5);
      expect(typeof d.shiny).toBe("boolean");
      expect(typeof d.shadow).toBe("boolean");
    }
  });
});
