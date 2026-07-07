import React from "react";

export default function AnalyticsView({ week, maxCount, log }) {
  return (
    <>
      <h2 className="le-h2" style={{ marginBottom: 12 }}>
        Last 7 days
      </h2>
      <section className="le-panel">
        <div className="le-chart">
          {week.map((d, i) => (
            <div key={i} className="le-bar-col">
              <div className="le-bar-count">{d.count > 0 ? d.count : d.frozen ? "🧊" : ""}</div>
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
          <span className="le-amber">{week.reduce((s, d) => s + d.xp, 0)} XP</span> this week
        </div>
      </section>

      <h2 className="le-h2" style={{ margin: "20px 0 12px" }}>
        Completion log
      </h2>
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
  );
}
