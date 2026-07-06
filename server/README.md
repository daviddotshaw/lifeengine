# LifeEngine push server

A tiny self-hosted service that makes **background reminders** work: reminders
that arrive even when the app is fully closed. The app itself keeps working
without it (in-app reminders only).

It stores, per device: a Web Push endpoint, the reminder time, a timezone, and
a "completed something today" flag. **No task data ever reaches the server.**
Every minute it checks which devices are past their local reminder time with
nothing completed today, and sends at most one push per device per day.
Expired subscriptions clean themselves up.

## Requirements

- Node.js 18+ on the server (`node --version`)
- An HTTPS hostname for it — a **subdomain of a domain you already own is
  enough** (e.g. `push.yourdomain.ie`); browsers require HTTPS for push
- lighttpd (or any reverse proxy) in front of it

## Setup

```bash
# 1. copy this server/ directory to the box, e.g.:
sudo mkdir -p /opt/lifeengine-push && sudo cp -r server/* /opt/lifeengine-push/
cd /opt/lifeengine-push && npm install

# 2. first run generates the VAPID keys (data/vapid.json) and prints the public key
node push-server.mjs   # Ctrl-C after it prints; or leave it to systemd below

# 3. run it as a service
sudo cp lifeengine-push.service /etc/systemd/system/
#    edit User=, WorkingDirectory=, ALLOWED_ORIGIN=, VAPID_CONTACT= as needed
sudo systemctl daemon-reload
sudo systemctl enable --now lifeengine-push
```

## DNS + HTTPS + lighttpd

1. Add a DNS A record for the subdomain (e.g. `push`) pointing at the server.
2. Get a certificate: `sudo certbot certonly --webroot` (or your usual method)
   for that subdomain, and build the combined PEM lighttpd wants:
   `cat privkey.pem cert.pem > /etc/lighttpd/certs/push.pem`
3. Enable `mod_proxy` and `mod_openssl`, then add a vhost:

```
$SERVER["socket"] == ":443" {
}
$HTTP["host"] == "push.yourdomain.ie" {
    ssl.engine  = "enable"
    ssl.pemfile = "/etc/lighttpd/certs/push.pem"
    proxy.server = ( "" => ( ( "host" => "127.0.0.1", "port" => 8787 ) ) )
}
```

4. `sudo systemctl reload lighttpd`, then check:
   `curl https://push.yourdomain.ie/health` → `{"ok":true,"subscriptions":0}`

## Connect the app

Put the URL in `src/push-config.js` in the repo:

```js
export const PUSH_SERVER = "https://push.yourdomain.ie";
```

Build and deploy (push to main). "Enable background reminders" then appears in
Settings → Daily reminder. The VAPID public key is fetched from the server, so
the URL is the only configuration.

## Notes

- `ALLOWED_ORIGIN` must be the app's origin (`https://daviddotshaw.github.io`
  for GitHub Pages — no path). Change it if the app ever moves.
- iPhone: push requires the app installed to the Home Screen (iOS 16.4+).
- The server binds to 127.0.0.1 only; the proxy is the sole way in.
- Back up `data/vapid.json` — if the keys change, every device has to
  re-enable reminders.
