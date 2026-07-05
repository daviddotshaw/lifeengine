/* ------------------------------------------------------------
   Task suggestions.
   - OFFLINE_SUGGESTIONS: curated static list, always available.
   - fetchAiSuggestions: asks the LLM for fresh ideas tailored to
     the user's current deck/stats. Requires an API key; throws
     on failure so the caller can fall back to the offline list.
   ------------------------------------------------------------ */

export const OFFLINE_SUGGESTIONS = [
  { title: "10-minute tidy of one room", diff: "easy", group: "chores" },
  { title: "Drink a glass of water", diff: "easy", group: "health" },
  { title: "5-minute stretch break", diff: "easy", group: "health" },
  { title: "Reply to one lingering message", diff: "easy", group: "social" },
  { title: "Take out the bins", diff: "easy", group: "chores" },
  { title: "20-minute walk outside", diff: "medium", group: "health" },
  { title: "Cook a proper meal (no takeaway)", diff: "medium", group: "health" },
  { title: "Clear your email inbox to zero", diff: "medium", group: "other" },
  { title: "Read 20 pages of a book", diff: "medium", group: "learning" },
  { title: "Doodle something for 10 minutes", diff: "easy", group: "creative" },
  { title: "Take five interesting photos on a walk", diff: "medium", group: "creative" },
  { title: "Do one load of laundry start to finish", diff: "medium", group: "chores" },
  { title: "Back up your important files", diff: "medium", group: "other" },
  { title: "30-minute workout", diff: "hard", group: "health" },
  { title: "Deep-clean the kitchen", diff: "hard", group: "chores" },
  { title: "One hour of focused work, no phone", diff: "hard", group: "learning" },
  { title: "Plan your week in advance", diff: "hard", group: "mindfulness" },
  { title: "Declutter one full wardrobe or drawer set", diff: "epic", group: "chores" },
  { title: "Finish that thing you've been putting off", diff: "epic", group: "other" },
  { title: "Digital declutter: photos, downloads, desktop", diff: "epic", group: "other" },
];

/** Random sample of n offline suggestions, excluding titles already in the deck. */
export function sampleOffline(n, excludeTitles = []) {
  const ex = new Set(excludeTitles.map((t) => t.toLowerCase()));
  const pool = OFFLINE_SUGGESTIONS.filter((s) => !ex.has(s.title.toLowerCase()));
  const out = [...pool];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, n);
}

export async function fetchAiSuggestions(apiKey, ctx) {
  if (!apiKey) throw new Error("no key");

  const prompt =
    `Suggest 5 realistic personal productivity / life-admin tasks for a young adult. ` +
    `Their current open tasks are: ${ctx.openTitles.length ? ctx.openTitles.join("; ") : "none"}. ` +
    `They have a ${ctx.streak}-day streak and ${ctx.xp} XP. ` +
    `Do not duplicate their open tasks. Mix difficulties. ` +
    `Respond ONLY with a JSON array, no markdown fences, no other text, in the form: ` +
    `[{"title":"...","diff":"easy|medium|hard|epic","group":"health|mindfulness|chores|learning|creative|social|other"}]. ` +
    `Titles max 8 words.`;

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
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);

  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .replace(/```json|```/g, "")
    .trim();

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("bad shape");
  const valid = new Set(["easy", "medium", "hard", "epic"]);
  const validGroups = new Set(["health", "mindfulness", "chores", "learning", "creative", "social", "other"]);
  return parsed
    .filter((s) => s && typeof s.title === "string" && s.title.trim())
    .map((s) => ({
      title: s.title.trim().slice(0, 80),
      diff: valid.has(s.diff) ? s.diff : "medium",
      group: validGroups.has(s.group) ? s.group : "other",
    }))
    .slice(0, 6);
}
