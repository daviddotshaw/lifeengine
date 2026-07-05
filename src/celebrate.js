/* ------------------------------------------------------------
   Completion celebration: confetti burst + haptics.
   No dependencies — DOM particles animated with the Web
   Animations API, removed when done. Respects reduced motion.
   navigator.vibrate is Android/Chrome only; iOS ignores it.
   ------------------------------------------------------------ */

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function haptic(pattern = [30, 40, 80]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

export function confetti({ colors, count = 80, origin } = {}) {
  if (reducedMotion()) return;
  const palette = colors?.length ? colors : ["#3E7C6F", "#a97c1e", "#C4604C", "#5B7DB1"];
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  box.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
  document.body.appendChild(box);

  const ox = origin?.x ?? window.innerWidth / 2;
  const oy = origin?.y ?? window.innerHeight * 0.35;
  let live = count;

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const s = 5 + Math.random() * 6;
    p.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;width:${s}px;height:${
      s * (Math.random() < 0.4 ? 1 : 0.5)
    }px;background:${palette[i % palette.length]};border-radius:${
      Math.random() < 0.3 ? "50%" : "2px"
    };`;
    box.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const speed = 140 + Math.random() * 340;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed * 0.7 - 160;
    const fall = 300 + Math.random() * 350;
    const rot = (Math.random() - 0.5) * 900;
    const dur = 900 + Math.random() * 900;

    p.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(${dx * 0.7}px, ${dy}px) rotate(${rot * 0.5}deg)`,
          opacity: 1,
          offset: 0.35,
        },
        {
          transform: `translate(${dx}px, ${dy + fall}px) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      { duration: dur, easing: "cubic-bezier(.16,.66,.46,1)" }
    ).onfinish = () => {
      p.remove();
      if (--live === 0) box.remove();
    };
  }

  /* safety net if animations get cancelled */
  setTimeout(() => box.remove(), 2600);
}
