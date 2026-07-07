/* ------------------------------------------------------------
   Collector flavor: every completed task catches a Pokémon
   (Pineco / Forretress / Mega Forretress) with weighted random
   stats and independent shiny/shadow/nuclear rarity flags.
   Hand-drawn art in public/art/, one file per species × variant
   combo — falls back to procedural SVG if a file is missing.
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

const SPECIES = [
  ["forretress", 80],
  ["pineco", 10],
  ["mega_forretress", 10],
];
const SPECIES_INFO = {
  pineco: { name: "Pineco", filePrefix: "Pineco" },
  forretress: { name: "Forretress", filePrefix: "Forretress" },
  mega_forretress: { name: "Mega Forretress", filePrefix: "MegaForretress" },
};
const speciesName = (d) => SPECIES_INFO[d.species]?.name || "Forretress";

const SIZES = [
  ["Tiny", 5],
  ["XS", 10],
  ["S", 20],
  ["Average", 30],
  ["L", 20],
  ["XL", 10],
  ["Huge", 5],
];
const WEIGHTS = [
  [1, 10],
  [2, 20],
  [3, 40],
  [4, 20],
  [5, 10],
];
const LUSTERS = [
  ["porous", 30],
  ["silky", 30],
  ["pearly", 25],
  ["adamant", 15],
];
const STRENGTHS = [
  ["weakest", 10],
  ["weak", 20],
  ["average", 30],
  ["strong", 20],
  ["strongest", 10],
];

const SIZE_SCALE = { Tiny: 0.5, XS: 0.65, S: 0.8, Average: 0.92, L: 1.05, XL: 1.2, Huge: 1.4 };
const SPIKES = { weakest: 5, weak: 6, average: 7, strong: 8, strongest: 10 };

/* Lucky rolls: every LUCKY_EVERY-th catch uses boosted rarity odds on
   all three independent flags. Shadow/nuclear share the same base rate
   so they share the same boost; shiny keeps its own (much larger) boost
   since its base rate is far rarer. At ~5 tasks/day: shiny roughly every
   3 weeks, a shadow+shiny (or nuclear+shiny) double roughly every 3
   months, and the full shiny+shadow+nuclear triple roughly once a year. */
const LUCKY_EVERY = 11;
const ODDS = { shiny: 1 / 4096, shadow: 1 / 100, nuclear: 1 / 100 };
const LUCKY_ODDS = { shiny: 1 / 10, shadow: 1 / 4, nuclear: 1 / 4 };

/** ctx.count = how many collector rewards exist already. */
function generate(task, ctx = {}) {
  const lucky = ((ctx.count || 0) + 1) % LUCKY_EVERY === 0;
  const odds = lucky ? LUCKY_ODDS : ODDS;
  return {
    species: pick(SPECIES),
    size: pick(SIZES),
    weight: pick(WEIGHTS),
    luster: pick(LUSTERS),
    strength: pick(STRENGTHS),
    shiny: Math.random() < odds.shiny,
    shadow: Math.random() < odds.shadow,
    nuclear: Math.random() < odds.nuclear,
    lucky,
  };
}

/* ---- procedural fallback: a spiky armoured orb, colours driven by
   the rarity flags — used only if a hand-drawn file is missing ---- */
function CreatureArt({ d, px = 84 }) {
  const scale = SIZE_SCALE[d.size] || 0.92;
  const body = d.shiny ? "#D8A93A" : d.shadow ? "#2A2233" : d.nuclear ? "#9DB017" : "#8B7BB5";
  const rim = d.shiny ? "#9C7414" : d.shadow ? "#120D1C" : d.nuclear ? "#5C6B0B" : "#5E5480";
  const spikeN = SPIKES[d.strength] || 7;
  const uid = `${d.size}-${d.luster}-${d.shiny}-${d.shadow}-${d.nuclear}-${spikeN}`;
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
    <svg viewBox="0 0 100 100" width={px} height={px} role="img" aria-label={speciesName(d)}>
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
      {d.nuclear && (
        <circle cx="50" cy="50" r={R + (d.shadow ? 20 : 15) * scale} fill="none" stroke="#B9D100" strokeOpacity="0.6" strokeWidth="3" strokeDasharray="2 5" />
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

/* File name convention, matching public/art/ exactly:
   {FilePrefix}_{Shiny_Shadow_Nuclear in that order, or Standard}.png */
function variantSuffix(d) {
  const parts = [];
  if (d.shiny) parts.push("Shiny");
  if (d.shadow) parts.push("Shadow");
  if (d.nuclear) parts.push("Nuclear");
  return parts.length ? parts.join("_") : "Standard";
}

/* Hand-drawn art from public/art/, one file per species × variant
   combo; falls back to the procedural SVG if a file is missing. */
function CreatureImg({ d, px = 84 }) {
  const [failed, setFailed] = useState(false);
  const scale = SIZE_SCALE[d.size] || 0.92;
  if (failed) return <CreatureArt d={d} px={px} />;
  const prefix = SPECIES_INFO[d.species]?.filePrefix || "Forretress";
  return (
    <img
      src={`${import.meta.env.BASE_URL}art/${prefix}_${variantSuffix(d)}.png`}
      width={Math.round(px * scale)}
      height={Math.round(px * scale)}
      alt={speciesName(d)}
      style={{ objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

const statLine = (d) =>
  `${d.size} · wt ${d.weight} · ${d.luster} · ${d.strength}`;

/** Emoji prefix for the three independent rarity flags, in a stable order. */
const badges = (d) =>
  `${d.shiny ? "🌟 " : ""}${d.shadow ? "🌑 " : ""}${d.nuclear ? "☢️ " : ""}`;

/** Rarity footer text, e.g. "★☾☢ SHINY SHADOW NUCLEAR" or "● COMMON". */
function rarityLabel(d) {
  const tags = [];
  if (d.shiny) tags.push(["★", "SHINY"]);
  if (d.shadow) tags.push(["☾", "SHADOW"]);
  if (d.nuclear) tags.push(["☢", "NUCLEAR"]);
  if (tags.length === 0) return "● COMMON";
  return `${tags.map((t) => t[0]).join("")} ${tags.map((t) => t[1]).join(" ")}`;
}

function Card({ reward }) {
  const d = reward.data;
  return (
    <div className="le-reward-card">
      <CreatureImg d={d} px={110} />
      <div className="le-reward-name">
        {badges(d)}
        {speciesName(d)}!
      </div>
      <div className="le-reward-stats">{statLine(d)}</div>
      {d.lucky && <div className="le-reward-lucky">⚡ Lucky roll — boosted odds!</div>}
    </div>
  );
}

/* Full-screen trading-card view of one creature. Frame background is
   built from all active rarity classes at once (CSS specificity picks
   the matching compound rule), so any of the 8 combos gets its own look. */
function FullCard({ reward, onClose, onRename }) {
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState(reward.name || "");
  const d = reward.data;
  const name = speciesName(d);
  const frameClass = [d.shiny && "shiny", d.shadow && "shadow", d.nuclear && "nuclear"]
    .filter(Boolean)
    .join(" ");
  const rarity = rarityLabel(d);
  const saveName = () => {
    onRename(draft.trim());
    setNaming(false);
  };
  return (
    <div className="le-tcard-pop" onClick={onClose}>
      <div className={`le-tcard ${frameClass}`} onClick={(e) => e.stopPropagation()}>
        <div className="le-tcard-head">
          <span className="le-tcard-name">
            {badges(d)}
            {reward.name || name}
            <button
              className="le-tcard-rename"
              onClick={() => {
                setDraft(reward.name || "");
                setNaming((n) => !n);
              }}
              aria-label={`Name this ${name}`}
            >
              ✎
            </button>
          </span>
          <span className="le-tcard-hp le-mono">WT {d.weight}/5</span>
        </div>
        {naming && (
          <div className="le-tcard-name-row">
            <input
              className="le-input"
              value={draft}
              maxLength={24}
              placeholder="Give it a name…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              autoFocus
            />
            <button className="le-btn moss" onClick={saveName}>
              Save
            </button>
          </div>
        )}
        <div className="le-tcard-art">
          <CreatureImg d={d} px={175} />
        </div>
        <div className="le-tcard-type">
          {d.size} Bagworm Pokémon · {d.luster} shell
        </div>
        <div className="le-tcard-rows">
          <div className="le-tcard-row"><span>Species</span><b>{name}</b></div>
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

const VARIANT_FILTERS = [
  ["all", "All"],
  ["shiny", "🌟 Shiny"],
  ["shadow", "🌑 Shadow"],
  ["nuclear", "☢️ Nuclear"],
  ["lucky", "⚡ Lucky"],
];

/* ---- dex completion: every size × luster × strength combo, across
   any species (species has its own filter/count instead) ---- */
const SIZE_LIST = SIZES.map(([s]) => s);
const LUSTER_LIST = LUSTERS.map(([l]) => l);
const STRENGTH_LIST = STRENGTHS.map(([s]) => s);
const TOTAL_COMBOS = SIZE_LIST.length * LUSTER_LIST.length * STRENGTH_LIST.length;
const SIZE_RANK = Object.fromEntries(SIZE_LIST.map((s, i) => [s, i]));
/** Rough "how special" ordering for the Rarest-first sort — not a strict
    probability ranking, just a sensible browsing order. */
const rarityRank = (d) => (d.shiny ? 2 : 0) + (d.shadow ? 1 : 0) + (d.nuclear ? 1 : 0);

function DexProgress({ mine }) {
  const combos = new Set(
    mine.map((r) => `${r.data.size}|${r.data.luster}|${r.data.strength}`)
  );
  const cellCount = (size, luster) =>
    mine.filter((r) => r.data.size === size && r.data.luster === luster).length;
  const strengthsCaught = new Set(mine.map((r) => r.data.strength)).size;
  const pct = Math.round((combos.size / TOTAL_COMBOS) * 100);
  return (
    <div className="le-panel le-dexprog">
      <div className="le-dexprog-head">
        <span>Dex completion</span>
        <span className="le-mono">
          {combos.size} / {TOTAL_COMBOS} · {pct}%
        </span>
      </div>
      <div className="le-dexprog-bar">
        <div style={{ width: `${Math.max(1, pct)}%` }} />
      </div>
      <div className="le-dexgrid">
        <span className="le-dexgrid-h" />
        {LUSTER_LIST.map((l) => (
          <span key={l} className="le-dexgrid-h">
            {l.slice(0, 3)}
          </span>
        ))}
        {SIZE_LIST.map((s) => [
          <span key={s} className="le-dexgrid-rowlabel">
            {s}
          </span>,
          ...LUSTER_LIST.map((l) => {
            const n = cellCount(s, l);
            return (
              <span
                key={`${s}-${l}`}
                className={`le-dexgrid-cell ${n > 0 ? "got" : ""}`}
                title={`${s} · ${l}: ${n} caught`}
              >
                {n > 0 ? n : ""}
              </span>
            );
          }),
        ])}
      </div>
      <div className="le-fineprint" style={{ marginTop: 8 }}>
        Grid: sizes × lusters (count of each caught, any species) · strengths found{" "}
        {strengthsCaught}/{STRENGTH_LIST.length}
      </div>
    </div>
  );
}

function RewardsView({ rewards, updateReward }) {
  const [openId, setOpenId] = useState(null);
  const [fVariant, setFVariant] = useState("all");
  const [fSpecies, setFSpecies] = useState("all");
  const [fSize, setFSize] = useState("all");
  const [fLuster, setFLuster] = useState("all");
  const [fStrength, setFStrength] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const mine = rewards.filter((r) => r.flavorId === "collector");
  const shinies = mine.filter((r) => r.data.shiny).length;
  const shadows = mine.filter((r) => r.data.shadow).length;
  const nuclears = mine.filter((r) => r.data.nuclear).length;
  const open = mine.find((r) => r.id === openId);
  const luckyIn = LUCKY_EVERY - (mine.length % LUCKY_EVERY);

  const needle = q.trim().toLowerCase();
  const filtered = mine.filter(
    (r) =>
      (fVariant === "all" ||
        (fVariant === "shiny"
          ? r.data.shiny
          : fVariant === "shadow"
          ? r.data.shadow
          : fVariant === "nuclear"
          ? r.data.nuclear
          : r.data.lucky)) &&
      (fSpecies === "all" || r.data.species === fSpecies) &&
      (fSize === "all" || r.data.size === fSize) &&
      (fLuster === "all" || r.data.luster === fLuster) &&
      (fStrength === "all" || r.data.strength === fStrength) &&
      (!needle ||
        (r.name || "").toLowerCase().includes(needle) ||
        r.taskTitle.toLowerCase().includes(needle))
  );
  const sorted = [...filtered].sort((a, b) =>
    sort === "oldest"
      ? a.at - b.at
      : sort === "size"
      ? SIZE_RANK[b.data.size] - SIZE_RANK[a.data.size] || b.at - a.at
      : sort === "rarity"
      ? rarityRank(b.data) - rarityRank(a.data) || b.at - a.at
      : sort === "name"
      ? (a.name || speciesName(a.data)).localeCompare(b.name || speciesName(b.data))
      : b.at - a.at // newest
  );
  const filtering =
    fVariant !== "all" ||
    fSpecies !== "all" ||
    fSize !== "all" ||
    fLuster !== "all" ||
    fStrength !== "all" ||
    !!needle;

  return (
    <>
      <h2 className="le-h2" style={{ marginBottom: 4 }}>Collection</h2>
      <p className="le-sub">
        {mine.length} caught · 🌟 {shinies} shiny · 🌑 {shadows} shadow · ☢️ {nuclears}{" "}
        nuclear — tap one for its card. ⚡{" "}
        {luckyIn === 1 ? "Next catch is a lucky roll!" : `Lucky roll in ${luckyIn} catches.`}
      </p>
      {mine.length > 0 && <DexProgress mine={mine} />}
      {mine.length > 0 && (
        <div className="le-dex-filters">
          <div className="le-dex-filter-row two">
            <input
              className="le-input le-search"
              placeholder="Search names…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="le-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="size">Biggest first</option>
              <option value="rarity">Rarest first</option>
              <option value="name">By name</option>
            </select>
          </div>
          <div className="le-dex-filter-row">
            {VARIANT_FILTERS.map(([id, label]) => (
              <button
                key={id}
                className={`le-diff ${fVariant === id ? "on" : ""}`}
                onClick={() => setFVariant(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="le-dex-filter-row">
            <select className="le-select" value={fSpecies} onChange={(e) => setFSpecies(e.target.value)}>
              <option value="all">Species: all</option>
              {Object.entries(SPECIES_INFO).map(([id, info]) => (
                <option key={id} value={id}>{info.name}</option>
              ))}
            </select>
            <select className="le-select" value={fSize} onChange={(e) => setFSize(e.target.value)}>
              <option value="all">Size: all</option>
              {SIZES.map(([s]) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="le-select" value={fLuster} onChange={(e) => setFLuster(e.target.value)}>
              <option value="all">Luster: all</option>
              {LUSTERS.map(([l]) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select className="le-select" value={fStrength} onChange={(e) => setFStrength(e.target.value)}>
              <option value="all">Strength: all</option>
              {STRENGTHS.map(([s]) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {filtering && (
            <div className="le-fineprint">
              Showing {filtered.length} of {mine.length}
            </div>
          )}
        </div>
      )}
      {mine.length === 0 && (
        <div className="le-empty">
          Complete a task to catch your first Pokémon. Every one rolls its own species,
          size, weight, luster and strength.
        </div>
      )}
      {mine.length > 0 && filtered.length === 0 && (
        <div className="le-empty">Nothing matches those filters.</div>
      )}
      <div className="le-dex">
        {sorted.map((r) => (
          <button
            key={r.id}
            className={`le-dex-cell ${r.data.shiny ? "shiny" : ""}`}
            onClick={() => setOpenId(r.id)}
          >
            <div className="le-dex-art">
              <CreatureImg d={r.data} px={72} />
            </div>
            <div className="le-dex-species">
              {r.name ? `${r.name} · ` : ""}
              {speciesName(r.data)}
            </div>
            <div className="le-dex-stats">
              {r.data.shiny && "🌟"}
              {r.data.shadow && "🌑"}
              {r.data.nuclear && "☢️"}
              {r.data.lucky && "⚡"} {statLine(r.data)}
            </div>
            <div className="le-dex-src">{r.taskTitle}</div>
          </button>
        ))}
      </div>
      {open && (
        <FullCard
          reward={open}
          onClose={() => setOpenId(null)}
          onRename={(name) => updateReward(open.id, { name })}
        />
      )}
    </>
  );
}

export const collector = {
  id: "collector",
  name: "Collector",
  glyph: "🛡️",
  tagline: "Every task caught generates a Pokémon.",
  palette: null, // keeps the classic palette; the creatures are the colour
  confettiColors: ["#8B7BB5", "#5E5480", "#D8A93A", "#3E7C6F"],
  reward: { noun: "Pokémon", tabLabel: "Collection", generate, Card },
  RewardsView,
};
