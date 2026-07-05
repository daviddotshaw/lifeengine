/* ------------------------------------------------------------
   Daily mentor quota generation.

   If an Anthropic API key is configured (Mentor tab → settings),
   the app calls the Messages API directly from the browser using
   the CORS opt-in header. This is acceptable for a personal
   single-user PWA where you control the device; do NOT ship a
   key this way in anything multi-user — put a small proxy in
   front instead (see README).

   Without a key, each mentor's local fallback generator is used,
   so the app is fully functional offline.
   ------------------------------------------------------------ */

export async function fetchQuota(mentor, ctx, apiKey) {
  if (!apiKey) return mentor.fallback(ctx);

  const prompt =
    `Context for today's message: the user has ${ctx.openCount} open tasks ` +
    `(next up: "${ctx.nextTask}"), a ${ctx.streak}-day streak, completed ` +
    `${ctx.today} tasks today, and has ${ctx.xp} total XP. ` +
    `Write today's motivational message.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: mentor.system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
  if (!text) throw new Error("empty response");
  return text;
}
