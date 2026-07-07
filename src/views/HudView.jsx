import React from "react";
import { DIFFS, diffOf } from "../mentors.js";
import { GROUPS, groupOf } from "../groups.js";
import { REPEATS, FREEZE_CAP } from "../logic.js";

export default function HudView({
  level,
  velocity,
  streak,
  freezes,
  openTasksCount,
  mentor,
  quota,
  quotaLoading,
  refreshQuota,
  adding,
  openAddPanel,
  addMode,
  setAddMode,
  newTitle,
  setNewTitle,
  newDiff,
  setNewDiff,
  newGroup,
  setNewGroup,
  newRepeat,
  setNewRepeat,
  addTask,
  suggestions,
  suggLoading,
  suggNote,
  shuffleSuggestions,
  aiSuggestions,
  addSuggestion,
  apiKey,
  boards,
  editingId,
  editDraft,
  setEditDraft,
  saveEdit,
  cancelEdit,
  completeTask,
  startEdit,
  confirmDelete,
  requestDelete,
}) {
  return (
    <>
      <section
        className="le-levelbar"
        title={`${level.into} / ${level.span} XP to Lv. ${level.level + 1}`}
      >
        <div className="le-levelbar-top">
          <span>
            Lv. {level.level} <span className="le-levelbar-title">— {level.title}</span>
          </span>
          <span className="le-mono le-levelbar-frac">
            {level.span > 0 ? `${level.into}/${level.span} XP` : "Max"}
          </span>
        </div>
        <div className="le-levelbar-bar">
          <div style={{ width: `${Math.max(2, level.pct * 100)}%` }} />
        </div>
      </section>

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
        <Metric label="In deck" value={openTasksCount} sub="open tasks" />
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
                  <button key={s.title} className="le-sugg" onClick={() => addSuggestion(s)}>
                    <span className="le-sugg-plus">+</span>
                    <span
                      className="le-dot-swatch"
                      style={{ background: groupOf(s.group).color }}
                    />
                    <span className="le-sugg-title">{s.title}</span>
                    <span className="le-sugg-xp le-mono">+{diffOf(s.diff).xp}</span>
                  </button>
                ))}
                {suggestions.length === 0 && !suggLoading && (
                  <div className="le-empty">All added — shuffle for more.</div>
                )}
                {suggNote && <div className="le-fineprint">{suggNote}</div>}
                <div className="le-key-row">
                  <button className="le-btn" onClick={shuffleSuggestions} disabled={suggLoading}>
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
                    AI ideas need an API key — add one in Settings. The shuffle list works
                    offline.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {openTasksCount === 0 && !adding && (
          <div className="le-empty">
            Deck is clear. Add a task to earn XP — your streak counts any day with at
            least one completion, and 🧊 freeze tokens cover missed days automatically.
            Recurring tasks return on their next cycle.
          </div>
        )}

        {boards.map(({ g, items }) => (
          <div key={g.id}>
            <div className="le-board-head">
              <span className="le-dot-swatch" style={{ background: g.color }} />
              {g.name}
              <span className="le-board-count">{items.filter((t) => !t.done).length}</span>
            </div>
            {items.map((t) =>
              editingId === t.id ? (
                <div key={t.id} className="le-add le-edit" style={{ borderLeftColor: g.color }}>
                  <input
                    className="le-input"
                    value={editDraft.title}
                    maxLength={80}
                    onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    autoFocus
                  />
                  <div className="le-diff-row">
                    {DIFFS.map((d) => (
                      <button
                        key={d.id}
                        className={`le-diff ${editDraft.diff === d.id ? "on" : ""}`}
                        onClick={() => setEditDraft((x) => ({ ...x, diff: d.id }))}
                      >
                        {d.label} <span className="le-diff-xp">+{d.xp}</span>
                      </button>
                    ))}
                  </div>
                  <div className="le-group-row">
                    {Object.values(GROUPS).map((gr) => (
                      <button
                        key={gr.id}
                        className={`le-group-chip ${editDraft.group === gr.id ? "on" : ""}`}
                        style={
                          editDraft.group === gr.id
                            ? { background: gr.color, borderColor: gr.color }
                            : undefined
                        }
                        onClick={() => setEditDraft((x) => ({ ...x, group: gr.id }))}
                      >
                        {gr.glyph} {gr.name}
                      </button>
                    ))}
                  </div>
                  <div className="le-diff-row">
                    {REPEATS.map((r) => (
                      <button
                        key={r.label}
                        className={`le-diff ${editDraft.repeat === r.id ? "on" : ""}`}
                        onClick={() => setEditDraft((x) => ({ ...x, repeat: r.id }))}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div className="le-key-row">
                    <button
                      className="le-btn moss"
                      onClick={saveEdit}
                      disabled={!editDraft.title.trim()}
                    >
                      Save
                    </button>
                    <button className="le-btn" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
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
                    <>
                      <button
                        className="le-x edit"
                        onClick={() => startEdit(t)}
                        aria-label={`Edit ${t.title}`}
                      >
                        ✎
                      </button>
                      <button
                        className={`le-x ${confirmDelete === t.id ? "armed" : ""}`}
                        onClick={() => requestDelete(t.id)}
                        aria-label={
                          confirmDelete === t.id
                            ? `Confirm removing ${t.title}`
                            : `Remove ${t.title}`
                        }
                      >
                        {confirmDelete === t.id ? "Sure?" : "×"}
                      </button>
                    </>
                  )}
                </div>
              )
            )}
          </div>
        ))}
      </section>
    </>
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
