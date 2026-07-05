/* ------------------------------------------------------------
   Task groups and default tasks.
   - GROUPS: the group registry. Each group has a colour used for
     board headers, card accents and dot boards.
   - DEFAULT_TASKS: the starter deck. Edit freely — new installs
     get these automatically, and Settings has an "Add default
     tasks" button that adds any that aren't already in the deck.
   ------------------------------------------------------------ */

export const GROUPS = {
  health: { id: "health", name: "Health", color: "#C4604C", glyph: "💪" },
  mindfulness: { id: "mindfulness", name: "Mindfulness", color: "#5B7DB1", glyph: "🧘" },
  chores: { id: "chores", name: "Chores", color: "#3E7C6F", glyph: "🧹" },
  learning: { id: "learning", name: "Learning", color: "#A8842C", glyph: "📚" },
  social: { id: "social", name: "Connection", color: "#9C6B9E", glyph: "💬" },
  other: { id: "other", name: "Other", color: "#6E7887", glyph: "🗂️" },
};

export const groupOf = (id) => GROUPS[id] || GROUPS.other;

export const DEFAULT_TASKS = [
  { title: "20-minute walk outside", diff: "easy", group: "health", repeat: "daily" },
  { title: "Drink a big glass of water", diff: "easy", group: "health", repeat: "daily" },
  { title: "30-minute workout", diff: "hard", group: "health", repeat: "weekly" },
  { title: "5 minutes of quiet breathing", diff: "easy", group: "mindfulness", repeat: "daily" },
  { title: "Write down one good thing today", diff: "easy", group: "mindfulness", repeat: "daily" },
  { title: "10-minute tidy of one room", diff: "easy", group: "chores", repeat: "daily" },
  { title: "Take out the bins", diff: "easy", group: "chores", repeat: "weekly" },
  { title: "One load of laundry start to finish", diff: "medium", group: "chores", repeat: "weekly" },
  { title: "Read 20 pages of a book", diff: "medium", group: "learning", repeat: "daily" },
  { title: "Practise a skill for 15 minutes", diff: "medium", group: "learning", repeat: "daily" },
  { title: "Message a friend", diff: "easy", group: "social", repeat: "daily" },
  { title: "Call family for a proper chat", diff: "medium", group: "social", repeat: "weekly" },
];
