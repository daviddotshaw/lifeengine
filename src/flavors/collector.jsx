/* ------------------------------------------------------------
   Collector flavor: every completed task generates a Forretress
   with weighted random stats. Original procedural SVG art — no
   third-party sprites. Stats are pure collection flavour.
   Tapping one in the gallery opens a full-screen trading card.
   ------------------------------------------------------------ */
import { useState } from "react";

/** Weighted pick: table is [[value, weight], ...]. */
function pick(table) {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [value, weight] of table) {
    r -= weight;
    if (r < 0) return value;
  }
  return table[table.length - 1][0];
}

const SIZES = [
  ["Tiny", 2],
  ["XS", 10],
  ["S", 20],
  ["Average", 36],
  ["L", 20],
  ["XL", 10],
  ["Huge", 2],
];
const WEIGHTS = [
  [1, 8],
  [2, 22],
  [3, 40],
  [4, 22],
  [5, 8],
];
const LUSTERS = [
  ["porous", 40],
  ["silky", 30],
  ["pearly", 20],
  ["adamant", 10],
];
const STRENGTHS = [
  ["weakest", 8],
  ["weak", 22],
  ["average", 40],
  ["strong", 22],
  ["strongest", 8],
];

const SIZE_SCALE = { Tiny: 0.5, XS: 0.65, S: 0.8, Average: 0.92, L: 1.05, XL: 1.2, Huge: 1.4 };
const SPIKES = { weakest: 5, weak: 6, average: 7, strong: 8, strongest: 10 };

function generate() {
  return {
    size: pick(SIZES),
    weight: pick(WEIGHTS),
    luster: pick(LUSTERS),
    strength: pick(STRENGTHS),
    shiny: Math.random() < 1 / 4096,
    shadow: Math.random() < 1 / 100,
  };
}

/* ---- art: a spiky armoured orb, colours driven by the stats ---- */
function ForretressArt({ d, px = 84 }) {
  const scale = SIZE_SCALE[d.size] || 0.92;
  const body = d.shiny ? "#D8A93A" : d.shadow ? "#2A2233" : "#8B7BB5";
  const rim = d.shiny ? "#9C7414" : d.shadow ? "#120D1C" : "#5E5480";
  const spikeN = SPIKES[d.strength] || 7;
  const uid = `${d.size}-${d.luster}-${d.shiny}-${d.shadow}-${spikeN}`;
  const R = 30 * scale;

  const spikes = [];
  for (let i = 0; i < spikeN; i++) {
    const a = (i / spikeN) * Math.PI * 2 - Math.PI / 2;
    const x1 = 50 + Math.cos(a - 0.22) * R;
    const y1 = 50 + Math.sin(a - 0.22) * R;
    const x2 = 50 + Math.cos(a + 0.22) * R;
    const y2 = 50 + Math.sin(a + 0.22) * R;
    const xt = 50 + Math.cos(a) * (R + 11 * scale);
    const yt = 50 + Math.sin(a) * (R + 11 * scale);
    spikes.push(
      <polygon key={i} points={`${x1},${y1} ${xt},${yt} ${x2},${y2}`} fill={rim} />
    );
  }

  return (
    <svg viewBox="0 0 100 100" width={px} height={px} role="img" aria-label="Forretress">
      <defs>
        <radialGradient id={`pearl-${uid}`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="45%" stopColor={body} />
          <stop offset="100%" stopColor={rim} />
        </radialGradient>
        <linearGradient id={`silk-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={body} />
          <stop offset="100%" stopColor={rim} />
        </linearGradient>
      </defs>
      {d.shadow && (
        <circle cx="50" cy="50" r={R + 15 * scale} fill="none" stroke="#7A3FA8" strokeOpacity="0.5" strokeWidth="3" strokeDasharray="5 7" />
      )}
      {spikes}
      <circle
        cx="50"
        cy="50"
        r={R}
        fill={
          d.luster === "pearly"
            ? `url(#pearl-${uid})`
            : d.luster === "silky"
            ? `url(#silk-${uid})`
            : body
        }
        stroke={rim}
        strokeWidth="3"
      />
      {d.luster === "porous" &&
        [
          [38, 40],
          [58, 34],
          [64, 56],
          [42, 62],
          [52, 48],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={50 + (cx - 50) * scale} cy={50 + (cy - 50) * scale} r={2.4 * scale} fill={rim} opacity="0.55" />
        ))}
      {d.luster === "adamant" && (
        <g opacity="0.35" stroke="#ffffff" strokeWidth="1.6" fill="none">
          <path d={`M50 ${50 - R} L${50 + R * 0.75} 50 L50 ${50 + R} L${50 - R * 0.75} 50 Z`} />
        </g>
      )}
      {/* dark visor + eyes peeking out of the armour */}
      <ellipse cx="50" cy="50" rx={13 * scale} ry={9 * scale} fill="#1B1626" />
      <circle cx={45.5 - 1.5 * scale} cy="49" r={2.6 * scale} fill={d.shadow ? "#D24A4A" : "#ffffff"} />
      <circle cx={54.5 + 1.5 * scale} cy="49" r={2.6 * scale} fill={d.shadow ? "#D24A4A" : "#ffffff"} />
      {d.shiny && (
        <g fill="#FFE79A">
          <path d="M18 16 l2.2 5 5 2.2 -5 2.2 -2.2 5 -2.2 -5 -5 -2.2 5 -2.2 Z" />
          <path d="M80 70 l1.7 3.8 3.8 1.7 -3.8 1.7 -1.7 3.8 -1.7 -3.8 -3.8 -1.7 3.8 -1.7 Z" />
        </g>
      )}
    </svg>
  );
}

/* Hand-drawn art from public/art/ when present (normal/shiny/shadow
   variants); falls back to the procedural SVG if a file is missing. */
function ForretressImg({ d, px = 84 }) {
  const [failed, setFailed] = useState(false);
  const scale = SIZE_SCALE[d.size] || 0.92;
  const variant = d.shiny ? "shiny" : d.shadow ? "shadow" : "normal";
  if (failed) return <ForretressArt d={d} px={px} />;
  return (
    <img
      src={`${import.meta.env.BASE_URL}art/forretress-${variant}.png`}
      width={Math.round(px * scale)}
      height={Math.round(px * scale)}
      alt="Forretress"
      style={{ objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

const statLine = (d) =>
  `${d.size} · wt ${d.weight} · ${d.luster} · ${d.strength}`;

function Card({ reward }) {
  const d = reward.data;
  return (
    <div className="le-reward-card">
      <ForretressImg d={d} px={110} />
      <div className="le-reward-name">
        {d.shiny && "🌟 Shiny "}
        {d.shadow && "🌑 Shadow "}Forretress!
      </div>
      <div className="le-reward-stats">{statLine(d)}</div>
    </div>
  );
}

/* Full-screen trading-card view of one creature. */
function FullCard({ reward, onClose }) {
  const d = reward.data;
  const frame = d.shiny ? "shiny" : d.shadow ? "shadow" : "";
  const rarity = d.shiny ? "★ SHINY" : d.shadow ? "☾ SHADOW" : "● COMMON";
  return (
    <div className="le-tcard-pop" onClick={onClose}>
      <div className={`le-tcard ${frame}`} onClick={(e) => e.stopPropagation()}>
        <div className="le-tcard-head">
          <span className="le-tcard-name">
            {d.shiny && "🌟 "}
            {d.shadow && "🌑 "}Forretress
          </span>
          <span className="le-tcard-hp le-mono">WT {d.weight}/5</span>
        </div>
        <div className="le-tcard-art">
          <ForretressImg d={d} px={175} />
        </div>
        <div className="le-tcard-type">
          {d.size} Bagworm Pokémon · {d.luster} shell
        </div>
        <div className="le-tcard-rows">
          <div className="le-tcard-row"><span>Size</span><b>{d.size}</b></div>
          <div className="le-tcard-row"><span>Weight</span><b>{d.weight} / 5</b></div>
          <div className="le-tcard-row"><span>Luster</span><b>{d.luster}</b></div>
          <div className="le-tcard-row"><span>Strength</span><b>{d.strength}</b></div>
        </div>
        <div className="le-tcard-flavor">
          “Caught while: {reward.taskTitle}”
        </div>
        <div className="le-tcard-foot">
          <span>
            {new Date(reward.at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span>{rarity}</span>
        </div>
        <button className="le-tcard-close" onClick={onClose} aria-label="Close card">
          ×
        </button>
      </div>
    </div>
  );
}

function RewardsView({ rewards }) {
  const [openId, setOpenId] = useState(null);
  const mine = rewards.filter((r) => r.flavorId === "collector");
  const shinies = mine.filter((r) => r.data.shiny).length;
  const shadows = mine.filter((r) => r.data.shadow).length;
  const open = mine.find((r) => r.id === openId);
  return (
    <>
      <h2 className="le-h2" style={{ marginBottom: 4 }}>Collection</h2>
      <p className="le-sub">
        {mine.length} caught · 🌟 {shinies} shiny · 🌑 {shadows} shadow — tap one for
        its card
      </p>
      {mine.length === 0 && (
        <div className="le-empty">
          Complete a task to generate your first Forretress. Every one rolls its own
          size, weight, luster and strength.
        </div>
      )}
      <div className="le-dex">
        {mine.map((r) => (
          <button
            key={r.id}
            className={`le-dex-cell ${r.data.shiny ? "shiny" : ""}`}
            onClick={() => setOpenId(r.id)}
          >
            <ForretressImg d={r.data} px={72} />
            <div className="le-dex-stats">
              {r.data.shiny && "🌟"}
              {r.data.shadow && "🌑"} {statLine(r.data)}
            </div>
            <div className="le-dex-src">{r.taskTitle}</div>
          </button>
        ))}
      </div>
      {open && <FullCard reward={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

export const collector = {
  id: "collector",
  name: "Collector",
  glyph: "🛡️",
  tagline: "Every task caught generates a Forretress.",
  palette: null, // keeps the classic palette; the creatures are the colour
  confettiColors: ["#8B7BB5", "#5E5480", "#D8A93A", "#3E7C6F"],
  reward: { noun: "Forretress", tabLabel: "Collection", generate, Card },
  RewardsView,
};
