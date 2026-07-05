# LifeEngine

Gamified motivation PWA — HUD-style metrics (velocity, streak, XP), a colour-coded grouped task deck, weekly analytics, an AI "Mentor" system with selectable personas, and switchable "flavors" that re-skin the app and change its reward system per device.

## Stack

Vite + React 18, `vite-plugin-pwa` (Workbox service worker, offline-first, installable), `idb` for IndexedDB persistence. No backend required.

## Quick start

```bash
npm install
npm run dev        # dev server
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

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
- **Collector** — every completed task generates a *Forretress* with weighted random stats (size, weight, luster, strength — bell-curved toward average), a 1/4096 shiny chance and a 1/100 shadow chance. Browse them in the **Collection** tab. The art is original procedural SVG.
- **Sunshine** — pretty colours, a gold star per completion, and colour-coded dot boards (one dot per completion, coloured by task group) in the **Stars** tab.

Adding a flavor mirrors adding a mentor: create one module in `src/flavors/` exporting `{ id, name, glyph, tagline, palette, confettiColors, reward, RewardsView }` and register it in `src/flavors/index.js`. Core components read only that interface.

## Task groups & default tasks

Tasks belong to a group (health, mindfulness, chores, learning, connection, other) defined in `src/groups.js`. The deck renders as colour-coded boards per group. `DEFAULT_TASKS` in the same file is the starter deck: new installs get it automatically, and **Settings → Starter tasks → Add default tasks** adds any that aren't already in the deck (matched by title). Edit that file to change the defaults.

## Task suggestions & recurring tasks

The **+ Task** panel has two modes:

- **Custom** — title, difficulty, group, and a repeat cadence: Once, Daily, Weekly, or Monthly. Recurring tasks award XP each completion, disappear for the rest of the current day/ISO week/calendar month, then return automatically. Deleting one (×) removes it permanently.
- **Suggested** — tap-to-add ideas. **Shuffle** draws from the offline list in `src/suggestions.js` (edit `OFFLINE_SUGGESTIONS` to make it yours); **✨ AI ideas** asks Claude for suggestions tailored to your current deck, streak, and XP (requires the API key below), falling back to the offline list if the call fails.

## Completion celebration & reminders

Completing a task fires a confetti burst (dependency-free, respects `prefers-reduced-motion`) and haptics via `navigator.vibrate` (Android/Chrome; iOS ignores it), plus the active flavor's reward pop-up.

**Settings → Daily reminder** shows a notification if nothing has been completed by a set time. This is local-only: it can only fire while the app is open, because without a backend there is no way to reach a fully closed PWA. True push reminders would need a small server holding Web Push subscriptions. The app also sets the icon badge to the open-task count where the Badging API exists (installed Chromium PWAs).

## Streak freezes

Missing a day normally resets the streak. Freeze tokens (🧊, shown next to the streak metric) soften that: when a past day would break the chain, tokens are spent automatically — one per missed day — but only if the whole gap can be covered and there's a streak behind it, so tokens are never wasted on an already-dead streak. Today is never frozen; the streak always survives until the day ends.

You start with 1 token, earn another at every 7-day streak milestone, and can hold at most 3. Frozen days appear as 🧊 in the weekly chart. Entirely local logic — works offline like everything else.

## Installing full screen

- **Android/Chrome:** open the site → menu → "Add to Home screen" / "Install app".
- **iOS/Safari:** share sheet → "Add to Home Screen".

It then launches standalone (no browser chrome), works offline, and keeps all data locally in IndexedDB.

## AI mentor transmissions

Without configuration, mentors use built-in offline quote generators — the app is fully functional with no network and no key.

To enable live AI-generated quotes, open **Settings** and paste an Anthropic API key. The key is stored only in the device's IndexedDB and calls `api.anthropic.com` directly from the browser (using the `anthropic-dangerous-direct-browser-access` opt-in header).

**This is only appropriate for a personal, single-user install on a device you control.** For anything shared or public, do not put a key in the client — stand up a small proxy endpoint that holds the key server-side and forwards `{mentorId, context}` requests, then point `src/ai.js` at it.

## Adding a mentor persona

Everything lives in `src/mentors.js`. Add one object to the `MENTORS` map:

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
  App.jsx       UI + state (HUD, boards, analytics, rewards, settings)
  mentors.js    persona registry + difficulty/XP table
  groups.js     task group registry + default task set
  flavors/      flavor registry (palette + reward system per flavor)
  celebrate.js  confetti + haptics
  suggestions.js offline suggestion list + AI suggestion fetcher
  ai.js         quota generation (API call or fallback)
  storage.js    IndexedDB key-value layer (idb)
  index.css     design tokens (CSS variables) & styles
  main.jsx      entry
```
