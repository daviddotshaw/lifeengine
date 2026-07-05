import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { MENTORS, DIFFS, diffOf } from "./mentors.js";
import { GROUPS, groupOf, DEFAULT_TASKS } from "./groups.js";
import { FLAVORS, flavorOf } from "./flavors/index.js";
import { confetti, haptic } from "./celebrate.js";
import { kvGet, kvSet, STATE_KEY } from "./storage.js";
import { fetchQuota } from "./ai.js";
import { sampleOffline, fetchAiSuggestions } from "./suggestions.js";

/* ---------------- date & period helpers ---------------- */
const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};
const todayKey = () => dayKey(Date.now());
const daysAgoKey = (n) => dayKey(Date.now() - n * 86400000);
const weekdayShort = (n) =>
  new Date(Date.now() - n * 86400000).toLocaleDateString(undefined, {
    weekday: "short",
  });

const isoWeekKey = (ts) => {
  const d = new Date(ts);
  const th = new Date(d);
  th.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3); // Thursday of this week
  const year = th.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week =
    1 + Math.round(((th - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${year}-W${week}`;
};
const monthKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
};
/** Current period key for a repeat cadence; null for one-off tasks. */
const periodKey = (repeat, ts = Date.now()) =>
  repeat === "daily"
    ? dayKey(ts)
    : repeat === "weekly"
    ? isoWeekKey(ts)
    : repeat === "monthly"
    ? monthKey(ts)
    : null;

const REPEATS = [
  { id: null, label: "Once" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

/* ---------------- streak freezes ---------------- */
/* Tokens auto-spent to bridge missed days so the streak survives.
   One is earned at every 7-day streak milestone, capped at FREEZE_CAP. */
const FREEZE_CAP = 3;

/* ---------------- derived metrics ---------------- */
function computeStreak(log, frozenDays = []) {
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
function computeVelocity(log) {
  const today = log.filter((e) => dayKey(e.completedAt) === todayKey()).length;
  const week = log.filter((e) => e.completedAt > Date.now() - 7 * 86400000).length;
  return { today, avg: Math.round((week / 7) * 10) / 10 };
}
function weekSeries(log, frozenDays = []) {
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

/* ============================================================ */
export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("hud"); // hud | analytics | rewards | settings
  const [tasks, setTasks] = useState([]);
  const [log, setLog] = useState([]);
  const [xp, setXp] = useState(0);
  const [mentorId, setMentorId] = useState("dungeon_master");
  const [flavorId, setFlavorId] = useState("classic");
  const [rewards, setRewards] = useState([]);
  const [justEarned, setJustEarned] = useState(null);
  const [reminder, setReminder] = useState({ enabled: false, time: "18:00" });
  const [lastReminded, setLastReminded] = useState(null);
  const [notifDenied, setNotifDenied] = useState(false);
  const [defaultsNote, setDefaultsNote] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [quota, setQuota] = useState(null); // {date, mentorId, text}
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState("custom"); // custom | suggested
  const [newTitle, setNewTitle] = useState("");
  const [newDiff, setNewDiff] = useState("medium");
  const [newRepeat, setNewRepeat] = useState(null);
  const [newGroup, setNewGroup] = useState("other");
  const [suggestions, setSuggestions] = useState([]);
  const [suggLoading, setSuggLoading] = useState(false);
  const [suggNote, setSuggNote] = useState("");
  const [pulseXp, setPulseXp] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [freezes, setFreezes] = useState(0);
  const [frozenDays, setFrozenDays] = useState([]); // dayKeys bridged by a spent token
  const [freezeEarnedDays, setFreezeEarnedDays] = useState([]); // dayKeys a milestone token was granted
  const [tick, setTick] = useState(0);
  const saveTimer = useRef(null);
  const earnTimer = useRef(null);

  /* mentorId "none" = no mentor: the transmission panel is hidden entirely */
  const mentor = mentorId === "none" ? null : MENTORS[mentorId] || MENTORS.dungeon_master;
  const flavor = flavorOf(flavorId);
  /* tick keeps date-dependent metrics fresh across midnight */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const streak = useMemo(() => computeStreak(log, frozenDays), [log, frozenDays, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const velocity = useMemo(() => computeVelocity(log), [log, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const week = useMemo(() => weekSeries(log, frozenDays), [log, frozenDays, tick]);

  /* Recurring tasks hide until their next period; done cards stay for exit anim. */
  const visibleTasks = tasks.filter(
    (t) => t.done || !t.repeat || t.lastPeriod !== periodKey(t.repeat)
  );
  const openTasks = visibleTasks.filter((t) => !t.done);
  /* deck grouped into colour-coded boards, in registry order */
  const boards = Object.values(GROUPS)
    .map((g) => ({ g, items: visibleTasks.filter((t) => groupOf(t.group).id === g.id) }))
    .filter((b) => b.items.length > 0);

  /* re-evaluate period boundaries once a minute so recurring tasks respawn */
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  /* load once */
  useEffect(() => {
    (async () => {
      const raw = await kvGet(STATE_KEY);
      const s = raw ? JSON.parse(raw) : null;
      if (s) {
        setTasks(s.tasks || []);
        setLog(s.log || []);
        setXp(s.xp || 0);
        setMentorId(s.mentorId || "dungeon_master");
        setQuota(s.quota || null);
        setApiKey(s.apiKey || "");
        setFreezes(s.freezes ?? 1); // pre-feature installs get the starter token
        setFrozenDays(s.frozenDays || []);
        setFreezeEarnedDays(s.freezeEarnedDays || []);
        setFlavorId(s.flavorId || "classic");
        setRewards(s.rewards || []);
        setReminder(s.reminder || { enabled: false, time: "18:00" });
        setLastReminded(s.lastReminded || null);
      } else {
        setFreezes(1);
        setTasks(
          DEFAULT_TASKS.map((d, i) => ({
            id: `seed${i}`,
            title: d.title,
            diff: d.diff,
            group: d.group,
            repeat: d.repeat || null,
            lastPeriod: null,
            done: false,
            createdAt: Date.now(),
          }))
        );
      }
      setReady(true);
    })();
  }, []);

  /* debounced persist */
  useEffect(() => {
    if (!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () =>
        kvSet(
          STATE_KEY,
          JSON.stringify({
            tasks,
            log,
            xp,
            mentorId,
            quota,
            apiKey,
            freezes,
            frozenDays,
            freezeEarnedDays,
            flavorId,
            rewards,
            reminder,
            lastReminded,
          })
        ),
      400
    );
    return () => clearTimeout(saveTimer.current);
  }, [tasks, log, xp, mentorId, quota, apiKey, freezes, frozenDays, freezeEarnedDays, flavorId, rewards, reminder, lastReminded, ready]);

  /* Spend freeze tokens to bridge missed days, walking back from yesterday.
     Only spends when the whole gap is coverable and a streak day sits behind it —
     tokens are never wasted on an already-broken streak. Today is never frozen
     (the streak survives until today ends). */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    const days = new Set(log.map((e) => dayKey(e.completedAt)));
    frozenDays.forEach((d) => days.add(d));
    if (days.size === 0) return;
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
    if (anchored && missing.length > 0 && missing.length <= freezes) {
      setFreezes((f) => f - missing.length);
      setFrozenDays((fd) => [...fd, ...missing]);
    }
  }, [ready, log, frozenDays, freezes, tick]);

  /* Earn a token at every 7-day streak milestone (once per day, capped). */
  useEffect(() => {
    if (!ready) return;
    if (streak > 0 && streak % 7 === 0 && !freezeEarnedDays.includes(todayKey())) {
      setFreezeEarnedDays((d) => [...d, todayKey()]);
      setFreezes((f) => Math.min(FREEZE_CAP, f + 1));
    }
  }, [ready, streak, freezeEarnedDays]);

  /* Apply the flavor palette at the document root so <body> and the PWA
     theme-color follow it too. */
  useEffect(() => {
    const el = document.documentElement;
    const KEYS = [
      "--le-bg", "--le-card", "--le-ink", "--le-muted", "--le-line",
      "--le-accent", "--le-accent-soft", "--le-accent-line",
      "--le-amber", "--le-amber-bg", "--le-amber-line", "--le-danger", "--le-bar",
    ];
    KEYS.forEach((k) => el.style.removeProperty(k));
    Object.entries(flavor.palette || {}).forEach(([k, v]) => el.style.setProperty(k, v));
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", getComputedStyle(el).getPropertyValue("--le-bg").trim() || "#F5F2EA");
  }, [flavor]);

  /* Rewards tab disappears if the active flavor has none. */
  useEffect(() => {
    if (view === "rewards" && !flavor.RewardsView) setView("hud");
  }, [view, flavor]);

  /* App icon badge = open task count (where the Badging API exists). */
  useEffect(() => {
    if (!ready) return;
    try {
      if (openTasks.length > 0) navigator.setAppBadge?.(openTasks.length);
      else navigator.clearAppBadge?.();
    } catch {
      /* unsupported */
    }
  }, [ready, openTasks.length]);

  /* Local daily reminder — fires only while the app is open (no backend).
     Checks on the minute tick: past the set time, nothing done today, deck
     not empty, not already reminded today. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready || !reminder.enabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const now = new Date();
    const [hh, mm] = reminder.time.split(":").map(Number);
    const due = now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm);
    const doneToday = log.some((e) => dayKey(e.completedAt) === todayKey());
    if (due && !doneToday && openTasks.length > 0 && lastReminded !== todayKey()) {
      setLastReminded(todayKey());
      const body = `${openTasks.length} task${openTasks.length === 1 ? "" : "s"} waiting — one completion keeps the streak alive.`;
      navigator.serviceWorker?.getRegistration?.().then((reg) => {
        if (reg?.showNotification) reg.showNotification("LifeEngine", { body, icon: "icon-192.png" });
        else new Notification("LifeEngine", { body });
      }).catch(() => {
        try { new Notification("LifeEngine", { body }); } catch { /* blocked */ }
      });
    }
  }, [tick, ready, reminder, log, lastReminded, openTasks.length]);

  const quotaCtx = useCallback(
    () => ({
      openCount: openTasks.length,
      nextTask: openTasks[0]?.title || "nothing yet",
      streak,
      today: velocity.today,
      xp,
    }),
    [openTasks, streak, velocity.today, xp]
  );

  const refreshQuota = useCallback(
    async (force = false) => {
      if (mentorId === "none" || !MENTORS[mentorId]) return;
      if (!force && quota && quota.date === todayKey() && quota.mentorId === mentorId)
        return;
      setQuotaLoading(true);
      const m = MENTORS[mentorId];
      const ctx = quotaCtx();
      let text;
      try {
        text = await fetchQuota(m, ctx, apiKey);
      } catch {
        text = m.fallback(ctx);
      }
      setQuota({ date: todayKey(), mentorId, text });
      setQuotaLoading(false);
    },
    [quota, mentorId, quotaCtx, apiKey]
  );

  useEffect(() => {
    if (ready) refreshQuota(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mentorId]);

  /* ---------------- suggestions ---------------- */
  const shuffleSuggestions = useCallback(() => {
    setSuggNote("");
    setSuggestions(
      sampleOffline(
        5,
        tasks.map((t) => t.title)
      )
    );
  }, [tasks]);

  const aiSuggestions = useCallback(async () => {
    setSuggLoading(true);
    setSuggNote("");
    try {
      const out = await fetchAiSuggestions(apiKey, {
        openTitles: openTasks.map((t) => t.title),
        streak,
        xp,
      });
      setSuggestions(out);
      setSuggNote("AI-generated for you");
    } catch {
      shuffleSuggestions();
      setSuggNote("AI unavailable — showing the offline list");
    }
    setSuggLoading(false);
  }, [apiKey, openTasks, streak, xp, shuffleSuggestions]);

  const openAddPanel = () => {
    setAdding((a) => {
      const next = !a;
      if (next && suggestions.length === 0) shuffleSuggestions();
      return next;
    });
  };

  /* ---------------- task ops ---------------- */
  const pushTask = (title, diff, repeat, group) =>
    setTasks((ts) => [
      {
        id: `t${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
        title,
        diff,
        group: groupOf(group).id,
        repeat: repeat || null,
        lastPeriod: null,
        done: false,
        createdAt: Date.now(),
      },
      ...ts,
    ]);

  const addTask = () => {
    const title = newTitle.trim();
    if (!title) return;
    pushTask(title, newDiff, newRepeat, newGroup);
    setNewTitle("");
    setNewRepeat(null);
    setAdding(false);
  };

  const addSuggestion = (s) => {
    pushTask(s.title, s.diff, null, s.group);
    setSuggestions((list) => list.filter((x) => x.title !== s.title));
  };

  /* add any DEFAULT_TASKS not already in the deck (by title) */
  const addDefaults = () => {
    const have = new Set(tasks.map((t) => t.title.toLowerCase()));
    const missing = DEFAULT_TASKS.filter((d) => !have.has(d.title.toLowerCase()));
    missing.forEach((d) => pushTask(d.title, d.diff, d.repeat, d.group));
    setDefaultsNote(
      missing.length === 0 ? "All default tasks are already in the deck" : `${missing.length} added to the deck`
    );
    setTimeout(() => setDefaultsNote(""), 2500);
  };

  const completeTask = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.done) return;
    const gain = diffOf(t.diff).xp;
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: true } : x)));
    setLog((l) => [
      {
        id: `l${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
        title: t.title,
        diff: t.diff,
        group: groupOf(t.group).id,
        xp: gain,
        completedAt: Date.now(),
      },
      ...l,
    ]);
    setXp((v) => v + gain);
    setPulseXp(true);
    setTimeout(() => setPulseXp(false), 700);
    confetti({ colors: flavor.confettiColors });
    haptic();
    if (flavor.reward) {
      const reward = {
        id: `r${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
        flavorId: flavor.id,
        taskTitle: t.title,
        group: groupOf(t.group).id,
        at: Date.now(),
        data: flavor.reward.generate(t),
      };
      setRewards((rs) => [reward, ...rs]);
      setJustEarned(reward);
      clearTimeout(earnTimer.current);
      earnTimer.current = setTimeout(() => setJustEarned(null), 2600);
    }
    setTimeout(() => {
      if (t.repeat) {
        /* recurring: park until next period instead of deleting */
        setTasks((ts) =>
          ts.map((x) =>
            x.id === id ? { ...x, done: false, lastPeriod: periodKey(t.repeat) } : x
          )
        );
      } else {
        setTasks((ts) => ts.filter((x) => x.id !== id));
      }
    }, 650);
  };

  const removeTask = (id) => setTasks((ts) => ts.filter((x) => x.id !== id));

  const toggleReminder = async () => {
    if (reminder.enabled) {
      setReminder((r) => ({ ...r, enabled: false }));
      return;
    }
    if (typeof Notification === "undefined") {
      setNotifDenied(true);
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setNotifDenied(true);
      return;
    }
    setNotifDenied(false);
    setReminder((r) => ({ ...r, enabled: true }));
  };

  const saveKey = () => {
    setApiKey(keyDraft.trim());
    setKeyDraft("");
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 1800);
  };

  if (!ready) return <div className="le-boot">Booting engine…</div>;

  const maxCount = Math.max(1, ...week.map((d) => d.count));

  return (
    <div className="le-root">
      {/* ---------- reward celebration overlay ---------- */}
      {justEarned && flavor.reward && (
        <div className="le-reward-pop" onClick={() => setJustEarned(null)}>
          <flavor.reward.Card reward={justEarned} />
        </div>
      )}

      {/* ---------- header ---------- */}
      <header className="le-head">
        <div className="le-logo">
          <span className="le-logo-mark">⬢</span> LifeEngine
        </div>
        <div className={`le-xp-chip ${pulseXp ? "pulse" : ""}`}>
          <span className="le-xp-num">{xp.toLocaleString()}</span> XP
        </div>
      </header>

      <main className="le-main">
        {view === "hud" && (
          <>
            <section className="le-strip">
              <Metric label="Velocity" value={velocity.today} sub={`avg ${velocity.avg}/day`} />
              <Metric
                label="Streak"
                value={streak}
                sub={`${streak === 1 ? "day" : "days"} · 🧊 ${freezes}`}
                hot={streak >= 3}
                title={`${freezes} freeze token${
                  freezes === 1 ? "" : "s"
                } — auto-spent to cover a missed day. Earn one at every 7-day streak milestone (max ${FREEZE_CAP}).`}
              />
              <Metric label="In deck" value={openTasks.length} sub="open tasks" />
            </section>

            {mentor && (
              <section className="le-quota">
                <div className="le-quota-top">
                  <div className="le-quota-who">
                    <span className="le-glyph">{mentor.glyph}</span>
                    <div>
                      <div className="le-quota-name">{mentor.name}</div>
                      <div className="le-quota-sub">Daily transmission</div>
                    </div>
                  </div>
                  <button
                    className="le-btn-ghost"
                    onClick={() => refreshQuota(true)}
                    disabled={quotaLoading}
                    aria-label="New message"
                  >
                    {quotaLoading ? "…" : "↻"}
                  </button>
                </div>
                <p className={`le-quota-text ${quotaLoading ? "dim" : ""}`}>
                  {quotaLoading ? "Consulting the mentor…" : quota?.text || "…"}
                </p>
              </section>
            )}

            <section>
              <div className="le-deck-head">
                <h2 className="le-h2">Active deck</h2>
                <button className="le-btn" onClick={openAddPanel}>
                  {adding ? "Close" : "+ Task"}
                </button>
              </div>

              {adding && (
                <div className="le-add">
                  <div className="le-mode-row">
                    <button
                      className={`le-mode ${addMode === "custom" ? "on" : ""}`}
                      onClick={() => setAddMode("custom")}
                    >
                      Custom
                    </button>
                    <button
                      className={`le-mode ${addMode === "suggested" ? "on" : ""}`}
                      onClick={() => setAddMode("suggested")}
                    >
                      Suggested
                    </button>
                  </div>

                  {addMode === "custom" && (
                    <>
                      <input
                        className="le-input"
                        placeholder="What needs doing?"
                        value={newTitle}
                        maxLength={80}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addTask()}
                        autoFocus
                      />
                      <div className="le-diff-row">
                        {DIFFS.map((d) => (
                          <button
                            key={d.id}
                            className={`le-diff ${newDiff === d.id ? "on" : ""}`}
                            onClick={() => setNewDiff(d.id)}
                          >
                            {d.label} <span className="le-diff-xp">+{d.xp}</span>
                          </button>
                        ))}
                      </div>
                      <div>
                        <div className="le-field-label">Group</div>
                        <div className="le-group-row">
                          {Object.values(GROUPS).map((g) => (
                            <button
                              key={g.id}
                              className={`le-group-chip ${newGroup === g.id ? "on" : ""}`}
                              style={
                                newGroup === g.id
                                  ? { background: g.color, borderColor: g.color }
                                  : undefined
                              }
                              onClick={() => setNewGroup(g.id)}
                            >
                              {g.glyph} {g.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="le-field-label">Repeats</div>
                        <div className="le-diff-row">
                          {REPEATS.map((r) => (
                            <button
                              key={r.label}
                              className={`le-diff ${newRepeat === r.id ? "on" : ""}`}
                              onClick={() => setNewRepeat(r.id)}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        className="le-btn wide"
                        onClick={addTask}
                        disabled={!newTitle.trim()}
                      >
                        Add to deck
                      </button>
                    </>
                  )}

                  {addMode === "suggested" && (
                    <>
                      {suggestions.map((s) => (
                        <button
                          key={s.title}
                          className="le-sugg"
                          onClick={() => addSuggestion(s)}
                        >
                          <span className="le-sugg-plus">+</span>
                          <span
                            className="le-dot-swatch"
                            style={{ background: groupOf(s.group).color }}
                          />
                          <span className="le-sugg-title">{s.title}</span>
                          <span className="le-sugg-xp le-mono">
                            +{diffOf(s.diff).xp}
                          </span>
                        </button>
                      ))}
                      {suggestions.length === 0 && !suggLoading && (
                        <div className="le-empty">All added — shuffle for more.</div>
                      )}
                      {suggNote && <div className="le-fineprint">{suggNote}</div>}
                      <div className="le-key-row">
                        <button
                          className="le-btn"
                          onClick={shuffleSuggestions}
                          disabled={suggLoading}
                        >
                          ↻ Shuffle
                        </button>
                        <button
                          className="le-btn moss"
                          onClick={aiSuggestions}
                          disabled={suggLoading || !apiKey}
                          title={apiKey ? "" : "Add an API key in Settings"}
                        >
                          {suggLoading ? "Thinking…" : "✨ AI ideas"}
                        </button>
                      </div>
                      {!apiKey && (
                        <p className="le-fineprint">
                          AI ideas need an API key — add one in Settings. The
                          shuffle list works offline.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {openTasks.length === 0 && !adding && (
                <div className="le-empty">
                  Deck is clear. Add a task to earn XP — your streak counts any day with
                  at least one completion, and 🧊 freeze tokens cover missed days
                  automatically. Recurring tasks return on their next cycle.
                </div>
              )}

              {boards.map(({ g, items }) => (
                <div key={g.id}>
                  <div className="le-board-head">
                    <span className="le-dot-swatch" style={{ background: g.color }} />
                    {g.name}
                    <span className="le-board-count">{items.filter((t) => !t.done).length}</span>
                  </div>
                  {items.map((t) => (
                    <div
                      key={t.id}
                      className={`le-card ${t.done ? "out" : ""}`}
                      style={{ borderLeftColor: g.color }}
                    >
                      <button
                        className={`le-check ${t.done ? "done" : ""}`}
                        onClick={() => completeTask(t.id)}
                        aria-label={`Complete ${t.title}`}
                      >
                        {t.done ? "✓" : ""}
                      </button>
                      <div className="le-card-body">
                        <div className="le-card-title">{t.title}</div>
                        <div className="le-card-meta">
                          {diffOf(t.diff).label} ·{" "}
                          <span className="le-amber">+{diffOf(t.diff).xp} XP</span>
                          {t.repeat && <span className="le-repeat"> · ↻ {t.repeat}</span>}
                        </div>
                      </div>
                      {!t.done && (
                        <button
                          className="le-x"
                          onClick={() => removeTask(t.id)}
                          aria-label={`Remove ${t.title}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          </>
        )}

        {view === "analytics" && (
          <>
            <h2 className="le-h2" style={{ marginBottom: 12 }}>Last 7 days</h2>
            <section className="le-panel">
              <div className="le-chart">
                {week.map((d, i) => (
                  <div key={i} className="le-bar-col">
                    <div className="le-bar-count">
                      {d.count > 0 ? d.count : d.frozen ? "🧊" : ""}
                    </div>
                    <div
                      className={`le-bar ${i === 6 ? "today" : ""}`}
                      style={{ height: `${Math.max(4, (d.count / maxCount) * 110)}px` }}
                      title={`${d.count} tasks · ${d.xp} XP`}
                    />
                    <div className="le-bar-label">{d.label}</div>
                  </div>
                ))}
              </div>
              <div className="le-chart-foot">
                {week.reduce((s, d) => s + d.count, 0)} completions ·{" "}
                <span className="le-amber">{week.reduce((s, d) => s + d.xp, 0)} XP</span>{" "}
                this week
              </div>
            </section>

            <h2 className="le-h2" style={{ margin: "20px 0 12px" }}>Completion log</h2>
            {log.length === 0 && (
              <div className="le-empty">Nothing completed yet. The log fills itself.</div>
            )}
            {log.slice(0, 40).map((e) => (
              <div key={e.id} className="le-log-row">
                <div>
                  <div className="le-card-title">{e.title}</div>
                  <div className="le-card-meta">
                    {new Date(e.completedAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    ·{" "}
                    {new Date(e.completedAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="le-amber le-mono">+{e.xp}</div>
              </div>
            ))}
          </>
        )}

        {view === "rewards" && flavor.RewardsView && (
          <flavor.RewardsView rewards={rewards} log={log} />
        )}

        {view === "settings" && (
          <>
            <div className="le-settings-section">
              <h2 className="le-h2" style={{ marginBottom: 4 }}>Style</h2>
              <p className="le-sub">Changes the look and the reward system on this device.</p>
              {Object.values(FLAVORS).map((f) => (
                <button
                  key={f.id}
                  className={`le-mentor ${f.id === flavorId ? "on" : ""}`}
                  onClick={() => setFlavorId(f.id)}
                >
                  <span className="le-glyph">{f.glyph}</span>
                  <span className="le-mentor-text">
                    <span className="le-card-title">{f.name}</span>
                    <span className="le-card-meta">{f.tagline}</span>
                  </span>
                  {f.id === flavorId && <span className="le-mentor-on">Active</span>}
                </button>
              ))}
            </div>

            <div className="le-settings-section">
              <h2 className="le-h2" style={{ marginBottom: 4 }}>Mentor</h2>
              <p className="le-sub">Sets the voice of your daily transmission.</p>
              <button
                className={`le-mentor ${mentorId === "none" ? "on" : ""}`}
                onClick={() => setMentorId("none")}
              >
                <span className="le-glyph">🔇</span>
                <span className="le-mentor-text">
                  <span className="le-card-title">No mentor</span>
                  <span className="le-card-meta">Silence. Just you and the deck.</span>
                </span>
                {mentorId === "none" && <span className="le-mentor-on">Active</span>}
              </button>
              {Object.values(MENTORS).map((m) => (
                <button
                  key={m.id}
                  className={`le-mentor ${m.id === mentorId ? "on" : ""}`}
                  onClick={() => setMentorId(m.id)}
                >
                  <span className="le-glyph">{m.glyph}</span>
                  <span className="le-mentor-text">
                    <span className="le-card-title">{m.name}</span>
                    <span className="le-card-meta">{m.tagline}</span>
                  </span>
                  {m.id === mentorId && <span className="le-mentor-on">Active</span>}
                </button>
              ))}
            </div>

            <div className="le-settings-section">
              <h2 className="le-h2" style={{ marginBottom: 4 }}>Daily reminder</h2>
              <p className="le-sub">
                A nudge if nothing is completed by the set time. Works while the app is
                open — without a server, the phone can't be reached once the app is
                fully closed.
              </p>
              <div className="le-add">
                <div className="le-key-row">
                  <button
                    className={`le-btn ${reminder.enabled ? "moss" : ""}`}
                    onClick={toggleReminder}
                  >
                    {reminder.enabled ? "Reminders on ✓" : "Enable reminders"}
                  </button>
                  <input
                    className="le-input"
                    type="time"
                    style={{ width: "auto" }}
                    value={reminder.time}
                    onChange={(e) =>
                      setReminder((r) => ({ ...r, time: e.target.value || "18:00" }))
                    }
                  />
                </div>
                {notifDenied && (
                  <p className="le-fineprint">
                    Notifications are blocked for this site — allow them in your
                    browser/site settings, then try again.
                  </p>
                )}
              </div>
            </div>

            <div className="le-settings-section">
              <h2 className="le-h2" style={{ marginBottom: 4 }}>Starter tasks</h2>
              <p className="le-sub">
                Adds the default task set (grouped: health, mindfulness, chores,
                learning, connection) — skips any already in your deck.
              </p>
              <div className="le-key-row">
                <button className="le-btn" onClick={addDefaults}>
                  Add default tasks
                </button>
                {defaultsNote && <p className="le-fineprint" style={{ alignSelf: "center" }}>{defaultsNote}</p>}
              </div>
            </div>

            <h2 className="le-h2" style={{ margin: "22px 0 4px" }}>AI connection</h2>
            <p className="le-sub">
              {apiKey
                ? "API key configured — transmissions and AI task ideas are live."
                : "No API key set — mentors use their built-in offline lines and task suggestions come from the offline list. Add an Anthropic API key for live AI generation."}
            </p>
            <div className="le-add">
              <input
                className="le-input"
                type="password"
                placeholder={apiKey ? "Replace saved key…" : "sk-ant-…"}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                autoComplete="off"
              />
              <div className="le-key-row">
                <button className="le-btn" onClick={saveKey} disabled={!keyDraft.trim()}>
                  {keySaved ? "Saved ✓" : "Save key"}
                </button>
                {apiKey && (
                  <button
                    className="le-btn danger"
                    onClick={() => {
                      setApiKey("");
                      setKeyDraft("");
                    }}
                  >
                    Remove key
                  </button>
                )}
              </div>
              <p className="le-fineprint">
                Stored only in this device's IndexedDB and sent only to api.anthropic.com.
                Single-user use only — never embed a key in a shared deployment.
              </p>
            </div>
          </>
        )}
      </main>

      <nav
        className="le-nav"
        style={{ gridTemplateColumns: `repeat(${flavor.RewardsView ? 4 : 3}, 1fr)` }}
      >
        {[
          ["hud", "HUD"],
          ["analytics", "Analytics"],
          ...(flavor.RewardsView
            ? [["rewards", flavor.reward?.tabLabel || "Rewards"]]
            : []),
          ["settings", "Settings"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`le-nav-btn ${view === id ? "on" : ""}`}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Metric({ label, value, sub, hot, title }) {
  return (
    <div className="le-metric" title={title}>
      <div className="le-metric-label">{label}</div>
      <div className={`le-metric-value ${hot ? "hot" : ""}`}>
        {value}
        {hot && <span className="le-flame">🔥</span>}
      </div>
      <div className="le-metric-sub">{sub}</div>
    </div>
  );
}
