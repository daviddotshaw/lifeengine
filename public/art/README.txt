Drop hand-drawn Pokémon art here, one PNG per species x variant combo,
named exactly:

  {Species}_{Variant}.png

Species (file prefix):
  Pineco
  Forretress
  MegaForretress

Variant (the active rarity flags, always in this order, joined by _;
no flags = Standard):
  Standard
  Shiny
  Shadow
  Nuclear
  Shiny_Shadow
  Shiny_Nuclear
  Shadow_Nuclear
  Shiny_Shadow_Nuclear

So 3 species x 8 variants = 24 files total, e.g.:
  Pineco_Standard.png
  Forretress_Shiny_Nuclear.png
  MegaForretress_Shiny_Shadow_Nuclear.png

PNG with a TRANSPARENT background, roughly square (e.g. 720x720).
Any missing file falls back to the built-in procedural SVG art for
that roll, so nothing breaks if one is missing — but check the app's
Collection tab reports no broken images before you consider it done.
