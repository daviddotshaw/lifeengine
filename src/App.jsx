import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { MENTORS, diffOf } from "./mentors.js";
import { GROUPS, groupOf, DEFAULT_TASKS } from "./groups.js";
import { flavorOf } from "./flavors/index.js";
import { confetti, haptic } from "./celebrate.js";
import { kvGet, kvSet, STATE_KEY } from "./storage.js";
import {
  pushConfigured,
  subscribePush,
  unsubscribePush,
  updatePushTime,
  pingDone,
} from "./push.js";
import { fetchQuota } from "./ai.js";
import { sampleOffline, fetchAiSuggestions } from "./suggestions.js";

import {
  dayKey,
  todayKey,
  periodKey,
  FREEZE_CAP,
  planFreezeSpend,
  computeStreak,
  computeVelocity,
  weekSeries,
  levelInfo,
} from "./logic.js";

import HudView from "./views/HudView.jsx";
import AnalyticsView from "./views/AnalyticsView.jsx";
import SettingsView from "./views/SettingsView.jsx";

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
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushNote, setPushNote] = useState("");
  const [pendingImport, setPendingImport] = useState(null); // parsed backup awaiting confirm
  const [importNote, setImportNote] = useState("");
  const importFileRef = useRef(null);
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
  const [confirmDelete, setConfirmDelete] = useState(null); // task id armed for deletion
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null); // {title, diff, group, repeat}
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
  const [undo, setUndo] = useState(null); // { taskId, title, gain, logId, rewardId, snapshotTask, ...freeze snapshot }
  const [levelUp, setLevelUp] = useState(null); // { level, title } transient banner
  const saveTimer = useRef(null);
  const earnTimer = useRef(null);
  const parkTimer = useRef(null);
  const undoTimer = useRef(null);
  const levelUpTimer = useRef(null);
  const prevLevelRef = useRef(null);

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
  const level = useMemo(() => levelInfo(xp), [xp]);

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
        setPushEnabled(s.pushEnabled ?? false);
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
            pushEnabled,
          })
        ),
      400
    );
    return () => clearTimeout(saveTimer.current);
  }, [tasks, log, xp, mentorId, quota, apiKey, freezes, frozenDays, freezeEarnedDays, flavorId, rewards, reminder, lastReminded, pushEnabled, ready]);

  /* Spend freeze tokens to bridge missed days, walking back from yesterday.
     Only spends when the whole gap is coverable and a streak day sits behind it —
     tokens are never wasted on an already-broken streak. Today is never frozen
     (the streak survives until today ends). */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    const missing = planFreezeSpend(log, frozenDays, freezes);
    if (missing.length > 0) {
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

  /* Celebrate level-ups. prevLevelRef starts null so loading an existing
     save never fires a false celebration — only a level crossed during
     this session counts. */
  useEffect(() => {
    if (!ready) return;
    if (prevLevelRef.current !== null && level.level > prevLevelRef.current) {
      setLevelUp({ level: level.level, title: level.title });
      confetti({ colors: flavor.confettiColors, count: 140 });
      haptic([30, 40, 30, 40, 120]);
      clearTimeout(levelUpTimer.current);
      levelUpTimer.current = setTimeout(() => setLevelUp(null), 3200);
    }
    prevLevelRef.current = level.level;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, level.level]);

  /* Ask the browser not to evict our IndexedDB under storage pressure. */
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

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

  /* Keep the server-side reminder time in sync when it changes. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready || !pushEnabled || !pushConfigured()) return;
    updatePushTime(reminder.time).catch(() => {});
  }, [reminder.time]);

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
    const logId = `l${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    /* snapshot for undo: the task exactly as it was, and freeze-token state
       before this completion could earn/spend a token */
    const snapshotTask = { ...t };
    const freezesSnapshot = freezes;
    const frozenDaysSnapshot = frozenDays;
    const freezeEarnedDaysSnapshot = freezeEarnedDays;

    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: true } : x)));
    setLog((l) => [
      {
        id: logId,
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
    /* tell the push server today is covered, so no evening nag */
    if (pushEnabled && pushConfigured()) pingDone().catch(() => {});

    let rewardId = null;
    if (flavor.reward) {
      rewardId = `r${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
      const reward = {
        id: rewardId,
        flavorId: flavor.id,
        taskTitle: t.title,
        group: groupOf(t.group).id,
        at: Date.now(),
        data: flavor.reward.generate(t, {
          count: rewards.filter((r) => r.flavorId === flavor.id).length,
        }),
      };
      setRewards((rs) => [reward, ...rs]);
      setJustEarned(reward);
      clearTimeout(earnTimer.current);
      earnTimer.current = setTimeout(() => setJustEarned(null), 2600);
    }

    clearTimeout(parkTimer.current);
    parkTimer.current = setTimeout(() => {
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

    clearTimeout(undoTimer.current);
    setUndo({
      taskId: id,
      title: t.title,
      gain,
      logId,
      rewardId,
      snapshotTask,
      freezesSnapshot,
      frozenDaysSnapshot,
      freezeEarnedDaysSnapshot,
    });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  };

  /* reverts everything completeTask did: XP, log entry, reward, freeze
     tokens, and the task itself (re-inserting it if it was already
     removed by the recurring/one-off park timer) */
  const undoLast = () => {
    if (!undo) return;
    clearTimeout(parkTimer.current);
    clearTimeout(undoTimer.current);
    clearTimeout(levelUpTimer.current);
    setLevelUp(null);
    if (undo.rewardId) {
      clearTimeout(earnTimer.current);
      setJustEarned((j) => (j && j.id === undo.rewardId ? null : j));
      setRewards((rs) => rs.filter((r) => r.id !== undo.rewardId));
    }
    setXp((v) => v - undo.gain);
    setLog((l) => l.filter((e) => e.id !== undo.logId));
    setTasks((ts) => {
      const exists = ts.some((x) => x.id === undo.taskId);
      return exists
        ? ts.map((x) => (x.id === undo.taskId ? undo.snapshotTask : x))
        : [undo.snapshotTask, ...ts];
    });
    setFreezes(undo.freezesSnapshot);
    setFrozenDays(undo.frozenDaysSnapshot);
    setFreezeEarnedDays(undo.freezeEarnedDaysSnapshot);
    setUndo(null);
  };

  const removeTask = (id) => setTasks((ts) => ts.filter((x) => x.id !== id));

  /* flavors can patch their own rewards (e.g. nicknames) */
  const updateReward = (id, patch) =>
    setRewards((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  /* first × tap arms the delete for 3s; second tap confirms */
  const deleteTimer = useRef(null);
  const requestDelete = (id) => {
    if (confirmDelete === id) {
      clearTimeout(deleteTimer.current);
      setConfirmDelete(null);
      removeTask(id);
      return;
    }
    setConfirmDelete(id);
    clearTimeout(deleteTimer.current);
    deleteTimer.current = setTimeout(() => setConfirmDelete(null), 3000);
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditDraft({
      title: t.title,
      diff: t.diff,
      group: groupOf(t.group).id,
      repeat: t.repeat || null,
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };
  const saveEdit = () => {
    const title = editDraft?.title.trim();
    if (!title) return;
    setTasks((ts) =>
      ts.map((x) =>
        x.id === editingId
          ? { ...x, title, diff: editDraft.diff, group: editDraft.group, repeat: editDraft.repeat }
          : x
      )
    );
    cancelEdit();
  };

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

  /* ---------------- backup: export / import ---------------- */
  const exportData = () => {
    const payload = {
      app: "lifeengine-backup",
      exportedAt: new Date().toISOString(),
      state: {
        tasks, log, xp, mentorId, quota, apiKey,
        freezes, frozenDays, freezeEarnedDays,
        flavorId, rewards, reminder, lastReminded, pushEnabled,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lifeengine-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImportFile = async (e) => {
    setImportNote("");
    setPendingImport(null);
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-choosing the same file
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      /* accept the export wrapper or a raw state object */
      const state = parsed.app === "lifeengine-backup" ? parsed.state : parsed;
      if (!state || !Array.isArray(state.tasks) || !Array.isArray(state.log))
        throw new Error("shape");
      setPendingImport({ state, exportedAt: parsed.exportedAt || null });
    } catch {
      setImportNote("That file doesn't look like a LifeEngine backup.");
    }
  };

  const applyImport = async () => {
    /* write straight to storage and reload so the normal load path
       (with its migration defaults) picks everything up */
    await kvSet(STATE_KEY, JSON.stringify(pendingImport.state));
    window.location.reload();
  };

  const togglePush = async () => {
    setPushNote("");
    try {
      if (pushEnabled) {
        await unsubscribePush();
        setPushEnabled(false);
        return;
      }
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setNotifDenied(true);
        return;
      }
      setNotifDenied(false);
      await subscribePush(reminder.time);
      setPushEnabled(true);
    } catch (e) {
      console.error("push toggle", e);
      setPushNote("Couldn't reach the push server — check it's up, then try again.");
    }
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

      {/* ---------- level-up celebration ----------
          A slim top banner rather than a full-screen modal, so it never
          competes with a flavor's reward pop-up when both fire together. */}
      {levelUp && (
        <div className="le-levelup-banner" onClick={() => setLevelUp(null)}>
          <span className="le-levelup-badge">Lv. {levelUp.level}</span>
          <span>Level up! You're now a {levelUp.title}.</span>
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
          <HudView
            level={level}
            velocity={velocity}
            streak={streak}
            freezes={freezes}
            openTasksCount={openTasks.length}
            mentor={mentor}
            quota={quota}
            quotaLoading={quotaLoading}
            refreshQuota={refreshQuota}
            adding={adding}
            openAddPanel={openAddPanel}
            addMode={addMode}
            setAddMode={setAddMode}
            newTitle={newTitle}
            setNewTitle={setNewTitle}
            newDiff={newDiff}
            setNewDiff={setNewDiff}
            newGroup={newGroup}
            setNewGroup={setNewGroup}
            newRepeat={newRepeat}
            setNewRepeat={setNewRepeat}
            addTask={addTask}
            suggestions={suggestions}
            suggLoading={suggLoading}
            suggNote={suggNote}
            shuffleSuggestions={shuffleSuggestions}
            aiSuggestions={aiSuggestions}
            addSuggestion={addSuggestion}
            apiKey={apiKey}
            boards={boards}
            editingId={editingId}
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            saveEdit={saveEdit}
            cancelEdit={cancelEdit}
            completeTask={completeTask}
            startEdit={startEdit}
            confirmDelete={confirmDelete}
            requestDelete={requestDelete}
          />
        )}

        {view === "analytics" && <AnalyticsView week={week} maxCount={maxCount} log={log} />}

        {view === "rewards" && flavor.RewardsView && (
          <flavor.RewardsView rewards={rewards} log={log} updateReward={updateReward} />
        )}

        {view === "settings" && (
          <SettingsView
            flavorId={flavorId}
            setFlavorId={setFlavorId}
            mentorId={mentorId}
            setMentorId={setMentorId}
            reminder={reminder}
            setReminder={setReminder}
            toggleReminder={toggleReminder}
            notifDenied={notifDenied}
            pushEnabled={pushEnabled}
            togglePush={togglePush}
            pushNote={pushNote}
            defaultsNote={defaultsNote}
            addDefaults={addDefaults}
            pendingImport={pendingImport}
            setPendingImport={setPendingImport}
            exportData={exportData}
            handleImportFile={handleImportFile}
            applyImport={applyImport}
            importNote={importNote}
            importFileRef={importFileRef}
            apiKey={apiKey}
            keyDraft={keyDraft}
            setKeyDraft={setKeyDraft}
            saveKey={saveKey}
            keySaved={keySaved}
            setApiKey={setApiKey}
          />
        )}
      </main>

      {undo && (
        <div className="le-undo-toast">
          <span>
            +{undo.gain} XP · {undo.title}
          </span>
          <button className="le-btn-ghost undo" onClick={undoLast}>
            Undo
          </button>
        </div>
      )}

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
