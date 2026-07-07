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

describe("collector generation", () => {
  const gen = collector.reward.generate;
  const species = ["forretress", "pineco", "mega_forretress"];
  const sizes = ["Tiny", "XS", "S", "Average", "L", "XL", "Huge"];
  const lusters = ["porous", "silky", "pearly", "adamant"];
  const strengths = ["weakest", "weak", "average", "strong", "strongest"];

  it("flags every 11th catch as lucky", () => {
    expect(gen({}, { count: 0 }).lucky).toBe(false);
    expect(gen({}, { count: 9 }).lucky).toBe(false);
    expect(gen({}, { count: 10 }).lucky).toBe(true);
    expect(gen({}, { count: 11 }).lucky).toBe(false);
    expect(gen({}, { count: 21 }).lucky).toBe(true);
  });

  it("always rolls valid species and stat values", () => {
    for (let i = 0; i < 500; i++) {
      const d = gen({}, { count: i });
      expect(species).toContain(d.species);
      expect(sizes).toContain(d.size);
      expect(lusters).toContain(d.luster);
      expect(strengths).toContain(d.strength);
      expect(d.weight).toBeGreaterThanOrEqual(1);
      expect(d.weight).toBeLessThanOrEqual(5);
      expect(typeof d.shiny).toBe("boolean");
      expect(typeof d.shadow).toBe("boolean");
      expect(typeof d.nuclear).toBe("boolean");
    }
  });

  /* Statistical checks against the spec'd percentages. Tolerances are
     generous (chosen from the binomial std-dev at n, times ~4-6) so
     these don't flake, while still catching a wrong odds table. */
  const tally = (n, ctxCount, pluck) => {
    const counts = {};
    for (let i = 0; i < n; i++) {
      const v = pluck(gen({}, { count: ctxCount }));
      counts[v] = (counts[v] || 0) + 1;
    }
    return counts;
  };
  const pct = (counts, key, n) => ((counts[key] || 0) / n) * 100;

  it("rolls species at 80/10/10", () => {
    const n = 20000;
    const c = tally(n, 0, (d) => d.species);
    expect(pct(c, "forretress", n)).toBeGreaterThan(76);
    expect(pct(c, "forretress", n)).toBeLessThan(84);
    expect(pct(c, "pineco", n)).toBeGreaterThan(7);
    expect(pct(c, "pineco", n)).toBeLessThan(13);
    expect(pct(c, "mega_forretress", n)).toBeGreaterThan(7);
    expect(pct(c, "mega_forretress", n)).toBeLessThan(13);
  });

  it("rolls size at 5/10/20/30/20/10/5", () => {
    const n = 20000;
    const c = tally(n, 0, (d) => d.size);
    const expected = { Tiny: 5, XS: 10, S: 20, Average: 30, L: 20, XL: 10, Huge: 5 };
    for (const [size, exp] of Object.entries(expected)) {
      expect(pct(c, size, n)).toBeGreaterThan(exp - 4);
      expect(pct(c, size, n)).toBeLessThan(exp + 4);
    }
  });

  it("rolls weight at 10/20/40/20/10", () => {
    const n = 20000;
    const c = tally(n, 0, (d) => d.weight);
    const expected = { 1: 10, 2: 20, 3: 40, 4: 20, 5: 10 };
    for (const [w, exp] of Object.entries(expected)) {
      expect(pct(c, Number(w), n)).toBeGreaterThan(exp - 4);
      expect(pct(c, Number(w), n)).toBeLessThan(exp + 4);
    }
  });

  it("rolls luster at 30/30/25/15", () => {
    const n = 20000;
    const c = tally(n, 0, (d) => d.luster);
    const expected = { porous: 30, silky: 30, pearly: 25, adamant: 15 };
    for (const [l, exp] of Object.entries(expected)) {
      expect(pct(c, l, n)).toBeGreaterThan(exp - 4);
      expect(pct(c, l, n)).toBeLessThan(exp + 4);
    }
  });

  it("rolls strength at 10/20/30/20/10", () => {
    const n = 20000;
    const c = tally(n, 0, (d) => d.strength);
    const expected = { weakest: 10, weak: 20, average: 30, strong: 20, strongest: 10 };
    for (const [s, exp] of Object.entries(expected)) {
      expect(pct(c, s, n)).toBeGreaterThan(exp - 4);
      expect(pct(c, s, n)).toBeLessThan(exp + 4);
    }
  });

  it("base (non-lucky) odds: shadow ~1%, nuclear ~1%", () => {
    const n = 20000; // ctx.count 0 -> never lucky
    let shadow = 0;
    let nuclear = 0;
    for (let i = 0; i < n; i++) {
      const d = gen({}, { count: 0 });
      if (d.shadow) shadow++;
      if (d.nuclear) nuclear++;
    }
    expect((shadow / n) * 100).toBeGreaterThan(0.5);
    expect((shadow / n) * 100).toBeLessThan(1.7);
    expect((nuclear / n) * 100).toBeGreaterThan(0.5);
    expect((nuclear / n) * 100).toBeLessThan(1.7);
  });

  it("base (non-lucky) shiny odds are ~1/4096", () => {
    const n = 200000; // low-probability event needs a bigger sample
    let shiny = 0;
    for (let i = 0; i < n; i++) {
      if (gen({}, { count: 0 }).shiny) shiny++;
    }
    const rate = shiny / n;
    expect(rate).toBeGreaterThan(1 / 8192);
    expect(rate).toBeLessThan(1 / 1500);
  });

  it("lucky odds: shiny ~10%, shadow ~25%, nuclear ~25%", () => {
    const n = 20000; // ctx.count 10 -> (10+1) % 11 === 0, always lucky
    let shiny = 0;
    let shadow = 0;
    let nuclear = 0;
    for (let i = 0; i < n; i++) {
      const d = gen({}, { count: 10 });
      expect(d.lucky).toBe(true);
      if (d.shiny) shiny++;
      if (d.shadow) shadow++;
      if (d.nuclear) nuclear++;
    }
    expect((shiny / n) * 100).toBeGreaterThan(7);
    expect((shiny / n) * 100).toBeLessThan(13);
    expect((shadow / n) * 100).toBeGreaterThan(20);
    expect((shadow / n) * 100).toBeLessThan(30);
    expect((nuclear / n) * 100).toBeGreaterThan(20);
    expect((nuclear / n) * 100).toBeLessThan(30);
  });
});
