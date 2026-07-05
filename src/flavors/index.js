/* ------------------------------------------------------------
   Flavor registry — same idea as the mentor registry: adding a
   flavor = adding one module here; core components read only
   this interface.
   Fields:
     id / name / glyph / tagline   picker display
     palette         CSS-variable overrides applied to the root
                     (null = classic palette)
     confettiColors  celebration colours
     reward          { noun, tabLabel, generate(), Card } or null
     RewardsView     component for the rewards tab, or null
   ------------------------------------------------------------ */
import { collector } from "./collector.jsx";
import { sunshine } from "./sunshine.jsx";

export const FLAVORS = {
  classic: {
    id: "classic",
    name: "Classic",
    glyph: "⬢",
    tagline: "The original engine. Calm and focused.",
    palette: null,
    confettiColors: ["#3E7C6F", "#a97c1e", "#C4604C", "#5B7DB1"],
    reward: null,
    RewardsView: null,
  },
  collector,
  sunshine,
};

export const flavorOf = (id) => FLAVORS[id] || FLAVORS.classic;
