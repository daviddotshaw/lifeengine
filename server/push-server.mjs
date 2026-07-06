/* ------------------------------------------------------------
   LifeEngine push server.

   Stores Web Push subscriptions with a daily reminder time and
   timezone, and every minute sends a reminder to any device
   whose local time has passed its reminder time — unless that
   device reported a completed task today. Holds NO task data.

   State lives in ./data/ (created on first run):
     vapid.json          auto-generated VAPID key pair
     subscriptions.json  one entry per device

   Env (all optional):
     PORT            listen port           (default 8787)
     ALLOWED_ORIGIN  CORS origin           (default https://daviddotshaw.github.io)
     VAPID_CONTACT   contact for VAPID     (default mailto:admin@localhost)
   ------------------------------------------------------------ */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, "data");
const VAPID_FILE = path.join(DATA_DIR, "vapid.json");
const SUBS_FILE = path.join(DATA_DIR, "subscriptions.json");

const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://daviddotshaw.github.io";
const VAPID_CONTACT = process.env.VAPID_CONTACT || "mailto:admin@localhost";

/* ---------- storage ---------- */
fs.mkdirSync(DATA_DIR, { recursive: true });

let vapid;
if (fs.existsSync(VAPID_FILE)) {
  vapid = JSON.parse(fs.readFileSync(VAPID_FILE, "utf8"));
} else {
  vapid = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapid, null, 2));
  console.log("Generated new VAPID key pair -> data/vapid.json");
}
webpush.setVapidDetails(VAPID_CONTACT, vapid.publicKey, vapid.privateKey);

let subs = {};
if (fs.existsSync(SUBS_FILE)) {
  try {
    subs = JSON.parse(fs.readFileSync(SUBS_FILE, "utf8"));
  } catch {
    console.error("subscriptions.json unreadable, starting empty");
  }
}
const saveSubs = () => fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
const keyFor = (endpoint) => crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 24);

/* ---------- time helpers ---------- */
const dayIn = (tz) => {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
  } catch {
    return new Date().toLocaleDateString("en-CA");
  }
};
const timeIn = (tz) => {
  try {
    return new Date().toLocaleTimeString("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }); // HH:MM
  } catch {
    return "00:00";
  }
};
const validTime = (t) => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/* ---------- scheduler ---------- */
async function tick() {
  for (const [id, s] of Object.entries(subs)) {
    const today = dayIn(s.tz);
    if (s.lastSent === today) continue; // already reminded today
    if (s.doneDay === today) continue; // task completed today, no nag
    if (timeIn(s.tz) < s.time) continue; // not time yet
    s.lastSent = today;
    try {
      await webpush.sendNotification(
        s.subscription,
        JSON.stringify({
          title: "LifeEngine",
          body: "Nothing completed yet today — one task keeps the streak alive.",
        })
      );
      console.log(`sent reminder ${id} (${s.tz} ${s.time})`);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log(`subscription ${id} expired, removing`);
        delete subs[id];
      } else {
        console.error(`send failed ${id}:`, err.statusCode || err.message);
      }
    }
  }
  saveSubs();
}
setInterval(() => tick().catch((e) => console.error("tick", e)), 60_000);

/* ---------- http ---------- */
const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 20_000) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (req.method === "OPTIONS") return send(204, {});
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/health")
      return send(200, { ok: true, subscriptions: Object.keys(subs).length });

    if (req.method === "GET" && url.pathname === "/vapid-public-key")
      return send(200, { key: vapid.publicKey });

    if (req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");

      if (url.pathname === "/subscribe") {
        const { subscription, time, tz } = body;
        if (!subscription?.endpoint || !validTime(time) || typeof tz !== "string")
          return send(400, { error: "bad request" });
        const id = keyFor(subscription.endpoint);
        subs[id] = {
          subscription,
          time,
          tz: tz.slice(0, 64),
          lastSent: subs[id]?.lastSent || null,
          doneDay: subs[id]?.doneDay || null,
        };
        saveSubs();
        return send(200, { ok: true });
      }

      if (url.pathname === "/unsubscribe") {
        if (body.endpoint) delete subs[keyFor(body.endpoint)];
        saveSubs();
        return send(200, { ok: true });
      }

      if (url.pathname === "/done") {
        const s = body.endpoint && subs[keyFor(body.endpoint)];
        if (s && /^\d{4}-\d{2}-\d{2}$/.test(body.day || "")) {
          s.doneDay = body.day;
          saveSubs();
        }
        return send(200, { ok: true });
      }
    }

    return send(404, { error: "not found" });
  } catch (err) {
    console.error("request error", err.message);
    return send(400, { error: "bad request" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`LifeEngine push server on 127.0.0.1:${PORT}`);
  console.log(`Allowed origin: ${ALLOWED_ORIGIN}`);
  console.log(`VAPID public key: ${vapid.publicKey}`);
});
