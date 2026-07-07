# LifeEngine

Gamified motivation PWA — HUD-style metrics (velocity, streak, XP, levels), a colour-coded grouped task deck, weekly analytics, an AI "Mentor" system with selectable personas, and switchable "flavors" that re-skin the app and change its reward system per device.

## Stack

Vite + React 18, `vite-plugin-pwa` (Workbox service worker, offline-first, installable), `idb` for IndexedDB persistence. No backend required.

## Quick start

```bash
npm install
npm run dev        # dev server
npm run test       # unit tests (streak/date/freeze logic in src/logic.js)
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

Tests also run in CI before every deploy.

`npm audit` currently reports findings in the vite/vitest/esbuild dev toolchain (not shipped in `dist/`, and only reachable via a dev server exposed to an untrusted network or `vitest --ui`, neither of which this project does). The real fixes require a major-version jump (vite 8 / vitest 4) which was tried and reverted — vitest 4 nests a different esbuild version than vite 5 expects, corrupting the lockfile's optional-dependency metadata and breaking `npm ci` in CI. Don't `npm audit fix --force` without re-testing `npm ci` on a real Linux host first.

A prebuilt `dist/` is included in this zip — you can deploy it as-is.

## Deploying (lighttpd)

Serve `dist/` as the document root of a vhost. The app is a single-page app but has only one route, so no rewrite rules are needed. It must be served over **HTTPS** (or localhost) for the service worker and install prompt to work.

```
$HTTP["host"] == "lifeengine.example.com" {
    server.document-root = "/var/www/lifeengine/dist"
}
```

After deploying an update, the service worker auto-updates on next load (`registerType: "autoUpdate"`).

## Deploying (GitHub Pages)

A workflow is included at `.github/workflows/deploy.yml` — it builds and deploys on every push to `main`.

1. Create a repo (e.g. `lifeengine`) and push this project to it.
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. Push to `main`. The site appears at `https://<user>.github.io/<repo>/`.

The workflow automatically sets the Vite base path to `/<repo>/`, so no code changes are needed regardless of the repo name. If you later attach a custom domain to Pages, remove the `BASE_PATH` env from the build step so it serves from `/`.

## Flavors

A flavor re-skins the app (CSS palette) and defines its reward system. Users pick one in **Settings → Style**; the choice is per device, like everything else. Built in:

- **Classic** — the original look, no reward layer (confetti and haptics still fire).
- **Collector** — every completed task catches a Pokémon, determined by three independent rolls:
  - **Species**: 80% Forretress, 10% Pineco, 10% Mega Forretress.
  - **Stats**, bell-curved toward the middle: Size (5/10/20/30/20/10/5% for Tiny/XS/S/Average/L/XL/Huge), Weight 1–5 (10/20/40/20/10%), Luster (30% porous, 30% silky, 25% pearly, 15% adamant), Strength (10/20/30/20/10% for weakest/weak/average/strong/strongest).
  - **Three independent rarity checks**, any combination possible: 1/4096 shiny, 1% shadow, 1% nuclear. Every 11th catch is a **⚡ lucky roll** with all three boosted (shiny 1/10, shadow 1/4, nuclear 1/4). Blended across lucky and normal catches, at ~5 tasks/day that works out to roughly: shadow or nuclear every ~6 days, shiny every ~3 weeks, a shadow+nuclear double every ~1 month, a shiny+shadow or shiny+nuclear double every ~3 months, and the full shiny+shadow+nuclear triple roughly once a year.
  
  Browse the catch in the **Collection** tab — a **Dex completion** panel tracks every size × luster × strength combination caught (140 total, across any species), and the gallery supports name search, sorting (newest/oldest/biggest/rarest/name) and filters by species, variant (shiny/shadow/nuclear/lucky), size, luster or strength. Tap a creature for a full-screen trading-card view (a distinct frame for each of the 8 rarity combinations) where it can be given a name. The art is loaded from `public/art/{Species}_{Variant}.png` — 24 hand-drawn files, transparent background, see `public/art/README.txt` for the exact naming; any missing file falls back to the built-in procedural SVG.
- **Sunshine** — pretty colours, a gold star per completion, and colour-coded dot boards (one dot per completion, coloured by task group) in the **Stars** tab.

Adding a flavor mirrors adding a mentor: create one module in `src/flavors/` exporting `{ id, name, glyph, tagline, palette, confettiColors, reward, RewardsView }` and register it in `src/flavors/index.js`. Core components read only that interface.

## Task groups & default tasks

Tasks belong to a group (health, mindfulness, chores, learning, connection, other) defined in `src/groups.js`. The deck renders as colour-coded boards per group. `DEFAULT_TASKS` in the same file is the starter deck: new installs get it automatically, and **Settings → Starter tasks → Add default tasks** adds any that aren't already in the deck (matched by title). Edit that file to change the defaults.

## Task suggestions & recurring tasks

The **+ Task** panel has two modes:

- **Custom** — title, difficulty, group, and a repeat cadence: Once, Daily, Weekly, or Monthly. Recurring tasks award XP each completion, disappear for the rest of the current day/ISO week/calendar month, then return automatically. Deleting one (×) removes it permanently.
- **Suggested** — tap-to-add ideas. **Shuffle** draws from the offline list in `src/suggestions.js` (edit `OFFLINE_SUGGESTIONS` to make it yours); **✨ AI ideas** asks Claude for suggestions tailored to your current deck, streak, and XP (requires the API key below), falling back to the offline list if the call fails.

## Completion celebration, undo & reminders

Completing a task fires a confetti burst (dependency-free, respects `prefers-reduced-motion`) and haptics via `navigator.vibrate` (Android/Chrome; iOS ignores it), plus the active flavor's reward pop-up. A toast at the bottom offers **Undo** for 5 seconds — it reverts the XP, log entry, reward, freeze-token state, and restores the task exactly as it was (even re-inserting it if a one-off task had already been removed, or a recurring task had already parked for its next cycle).

**Settings → Daily reminder** shows a notification if nothing has been completed by a set time. Out of the box this is local-only (fires while the app is open). For **background reminders** — arriving with the app fully closed — deploy the tiny self-hosted companion service in [`server/`](server/README.md) and set its URL in `src/push-config.js`; an "Enable background reminders" button then appears. The server holds only push endpoints, reminder times and timezones — never task data — and completing any task cancels that day's reminder. The app also sets the icon badge to the open-task count where the Badging API exists (installed Chromium PWAs).

## XP levels

Total XP maps to a level and title (Newcomer → Habit Starter → … → Living Legend) on a quadratic curve — each level needs progressively more XP than the last, so early levels arrive quickly and the game stays a long-term goal without ever hard-capping. A progress bar in the HUD shows XP into the current level, and crossing a threshold pops a level-up banner with confetti. Pure logic lives in `levelInfo()` in `src/logic.js`, covered by unit tests.

## Streak freezes

Missing a day normally resets the streak. Freeze tokens (🧊, shown next to the streak metric) soften that: when a past day would break the chain, tokens are spent automatically — one per missed day — but only if the whole gap can be covered and there's a streak behind it, so tokens are never wasted on an already-dead streak. Today is never frozen; the streak always survives until the day ends.

You start with 1 token, earn another at every 7-day streak milestone, and can hold at most 3. Frozen days appear as 🧊 in the weekly chart. Entirely local logic — works offline like everything else.

## Backups

All data lives in the device's IndexedDB (the app requests persistent storage so the browser won't evict it). **Settings → Your data → Export backup** downloads a JSON file with everything — tasks, history, XP, freezes, rewards, settings; **Import backup…** restores it (replacing the device's current data), which is also how you move to a new phone. The file includes the API key if one is saved, so treat it as private.

## Installing full screen

- **Android/Chrome:** open the site → menu → "Add to Home screen" / "Install app".
- **iOS/Safari:** share sheet → "Add to Home Screen".

It then launches standalone (no browser chrome), works offline, and keeps all data locally in IndexedDB.

## AI mentor transmissions

Without configuration, mentors use built-in offline quote generators — the app is fully functional with no network and no key.

To enable live AI-generated quotes, open **Settings** and paste an Anthropic API key. The key is stored only in the device's IndexedDB and calls `api.anthropic.com` directly from the browser (using the `anthropic-dangerous-direct-browser-access` opt-in header).

**This is only appropriate for a personal, single-user install on a device you control.** For anything shared or public, do not put a key in the client — stand up a small proxy endpoint that holds the key server-side and forwards `{mentorId, context}` requests, then point `src/ai.js` at it.

## Adding a mentor persona

Mentors are chosen in **Settings**, which also offers a **No mentor** option that hides the daily transmission entirely. Everything lives in `src/mentors.js`. Add one object to the `MENTORS` map:

```js
noir_detective: {
  id: "noir_detective",
  name: "Noir Detective",
  glyph: "🕵️",
  tagline: "Every task is a case. Most go unsolved.",
  system: "You are a world-weary noir detective acting as a daily motivation mentor... ONE message, 1-2 sentences, max 40 words.",
  fallback: (c) => `The city had ${c.openCount} open cases and one tired hero. Crack the first one before lunch.`,
},
```

No other files change — the picker, quota generation, and storage pick it up automatically.

## Structure

```
src/
  App.jsx           state + wiring: load/save, task ops, completion/undo,
                    levels, freezes, push, renders the views below
  views/
    HudView.jsx       level bar, metrics, mentor quota, + Task panel, boards
    AnalyticsView.jsx weekly chart + completion log
    SettingsView.jsx  style/mentor/reminders/starter tasks/backups/API key
                    (the Rewards tab is the active flavor's own RewardsView)
  logic.js          pure date/streak/freeze/level logic — unit tested
  logic.test.js     vitest suite for logic.js (runs in CI before deploy)
  mentors.js        persona registry + difficulty/XP table
  groups.js         task group registry + default task set
  flavors/          flavor registry (palette + reward system per flavor)
  celebrate.js      confetti + haptics
  suggestions.js    offline suggestion list + AI suggestion fetcher
  ai.js             quota generation (API call or fallback)
  push.js / push-config.js   Web Push client (dormant until configured)
  sw.js             custom service worker (precache + push handlers)
  storage.js        IndexedDB key-value layer (idb)
  index.css         design tokens (CSS variables) & styles
  main.jsx          entry
server/             companion push server — see server/README.md
```
