/* ------------------------------------------------------------
   Background-reminder (Web Push) configuration.

   PUSH_SERVER: base URL of the companion push server (see
   server/README.md), e.g. "https://push.example.ie". Leave empty
   to disable — the app then offers in-app reminders only and
   nothing push-related runs. The VAPID public key is fetched
   from the server, so this URL is the only thing to configure.
   ------------------------------------------------------------ */
export const PUSH_SERVER = "https://push.dublincanvasgo.ie";
