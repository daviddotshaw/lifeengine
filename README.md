# LifeEngine

Gamified motivation PWA — HUD-style metrics (velocity, streak, XP), a card-based task deck, weekly analytics, and an AI "Mentor" system with selectable personas.

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

## Task suggestions & recurring tasks

The **+ Task** panel has two modes:

- **Custom** — title, difficulty, and a repeat cadence: Once, Daily, Weekly, or Monthly. Recurring tasks award XP each completion, disappear for the rest of the current day/ISO week/calendar month, then return automatically. Deleting one (×) removes it permanently.
- **Suggested** — tap-to-add ideas. **Shuffle** draws from the offline list in `src/suggestions.js` (edit `OFFLINE_SUGGESTIONS` to make it yours); **✨ AI ideas** asks Claude for suggestions tailored to your current deck, streak, and XP (requires the API key below), falling back to the offline list if the call fails.

## Installing full screen

- **Android/Chrome:** open the site → menu → "Add to Home screen" / "Install app".
- **iOS/Safari:** share sheet → "Add to Home Screen".

It then launches standalone (no browser chrome), works offline, and keeps all data locally in IndexedDB.

## AI mentor transmissions

Without configuration, mentors use built-in offline quote generators — the app is fully functional with no network and no key.

To enable live AI-generated quotes, open the **Mentor** tab and paste an Anthropic API key. The key is stored only in the device's IndexedDB and calls `api.anthropic.com` directly from the browser (using the `anthropic-dangerous-direct-browser-access` opt-in header).

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
  App.jsx       UI + state (HUD, deck, analytics, mentor picker)
  mentors.js    persona registry + difficulty/XP table
  ai.js         quota generation (API call or fallback)
  storage.js    IndexedDB key-value layer (idb)
  index.css     design tokens & styles
  main.jsx      entry
```
