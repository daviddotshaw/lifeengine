/* ------------------------------------------------------------
   Sunshine flavor: keep it simple. Pretty colours, a gold star
   for every completed task, and colour-coded dot boards — one
   dot per completion, coloured by task group.
   ------------------------------------------------------------ */
import { GROUPS, groupOf } from "../groups.js";

function generate() {
  return { star: true };
}

function Card() {
  return (
    <div className="le-reward-card">
      <div className="le-star-pop">⭐</div>
      <div className="le-reward-name">Gold star!</div>
      <div className="le-reward-stats">Lovely work.</div>
    </div>
  );
}

const DOT_WINDOW_DAYS = 28;

function RewardsView({ rewards, log }) {
  const stars = rewards.filter((r) => r.flavorId === "sunshine").length;
  const since = Date.now() - DOT_WINDOW_DAYS * 86400000;
  const recent = log.filter((e) => e.completedAt >= since);
  return (
    <>
      <h2 className="le-h2" style={{ marginBottom: 4 }}>Gold stars</h2>
      <p className="le-sub">
        ⭐ {stars} earned · dot boards show the last {DOT_WINDOW_DAYS} days, one dot per
        completed task
      </p>
      {Object.values(GROUPS).map((g) => {
        const dots = recent.filter((e) => groupOf(e.group).id === g.id);
        if (g.id === "other" && dots.length === 0) return null;
        return (
          <div key={g.id} className="le-dotboard" style={{ borderColor: g.color }}>
            <div className="le-dotboard-head">
              <span className="le-dot-swatch" style={{ background: g.color }} />
              {g.glyph} {g.name}
              <span className="le-dotboard-n">{dots.length}</span>
            </div>
            <div className="le-dots">
              {dots.map((e) => (
                <span
                  key={e.id}
                  className="le-dot"
                  style={{ background: g.color }}
                  title={e.title}
                />
              ))}
              {dots.length === 0 && <span className="le-dots-none">no dots yet</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}

export const sunshine = {
  id: "sunshine",
  name: "Sunshine",
  glyph: "⭐",
  tagline: "Simple, pretty, gold stars.",
  palette: {
    "--le-bg": "#FBEFF3",
    "--le-card": "#FFFFFF",
    "--le-ink": "#4A3B44",
    "--le-muted": "#9B7E8C",
    "--le-line": "#F0D9E2",
    "--le-accent": "#D96A9C",
    "--le-accent-soft": "#FADCE8",
    "--le-accent-line": "#F2C4D6",
    "--le-amber": "#C08A18",
    "--le-amber-bg": "#FDF3D7",
    "--le-amber-line": "#F1E2B4",
    "--le-bar": "#EDD5DE",
  },
  confettiColors: ["#F7C948", "#D96A9C", "#8AC6D1", "#B5E0A5"],
  reward: { noun: "gold star", tabLabel: "Stars", generate, Card },
  RewardsView,
};
