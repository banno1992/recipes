# Brief for recipe subagents (Sonnet)

You turn recipes into this app's JSON format. The orchestrator gives you a list of
**inputs** (card folders or web URLs). Work from the repo root
`C:\Users\Jordan\Desktop\recipe-app` (Windows, PowerShell, Python 3.8 + Pillow).

## Read first
1. `CLAUDE.md`: the spec. Follow "Rewriting rules", "Schema" and "Conventions settled in the pilot" exactly.
2. Finished examples:
   - HelloFresh: `recipes/asian-style-meatballs.json` + its verbatim transcript `transcripts/asian-style-meatballs.md`
   - Gousto: `recipes/aubergine-yasai-curry.json` + `transcripts/aubergine-yasai-curry.md`
3. `tools/ingredients.json`: canonical names already in use. Reuse them. Don't edit this file; report new aliases instead.

## Card inputs (`work/card-NNN/`)
Each folder has upright photos: `front.jpg`, `back.jpg`, and halves `front-left.jpg`,
`front-right.jpg`, `back-left.jpg`, `back-right.jpg` for reading small print. Look at
all of them. The front has the title, photo and (Gousto) ingredients; the back has the
method and (HelloFresh) the 2P/3P/4P ingredient table. Older HelloFresh cards
("PREPARED!" / "INGREDIENTS" headings) lay this out differently; the content is the same.

Per card:
1. Pick `id`: kebab-case of the main title (no subtitle), e.g. "Chicken Rogan Josh" → `chicken-rogan-josh`.
   If `recipes/<id>.json` already exists, stop on that card and report it as a possible duplicate.
2. Transcribe verbatim to `transcripts/<id>.md` (title, subtitle, time, servings table / quantities, every step, allergens line).
   If text is unreadable, write `[unreadable]` – never guess.
3. Structure into `recipes/<id>.json` per the schema. `source: {"type":"card","brand":"HelloFresh"|"Gousto","url":null}`, `image: "images/<id>.jpg"`.
4. Hero image: open `work/card-NNN/front.jpg`, judge the dish photo's bounding box as fractions of width/height
   (just the food photo, no text, card edge or binder rings), then run
   `python tools/crop_hero.py work/card-NNN/front.jpg <id> x0 y0 x1 y1`. Open `images/<id>.jpg` and check it; recrop if it's poor.

## Web inputs (URL)
1. Fetch the page HTML (e.g. `python -c` with urllib and a browser User-Agent) and parse the
   `<script type="application/ld+json">` block whose `@type` is `Recipe`. Use only: name, description's
   "with …" part if the title has none (else leave subtitle from the name split at " with "), recipeYield,
   totalTime, recipeIngredient, recipeInstructions, image. Ignore everything else on the page.
2. Save the raw JSON-LD to `transcripts/<id>.md` (in a ```json block) as the verbatim record.
3. `source: {"type":"web","brand":"HelloFresh","url":"<url>"}`. HelloFresh JSON-LD gives one serving column
   (usually 2): set `servings.base` to it and `available` to `[base]`; the app scales the rest.
   Ingredient strings look like "240 grams Diced Chicken Breast", "1 unit(s) Red Onion", "1 sachet(s) Curry Powder Mix":
   convert to the schema's units (grams→g, milliliter(s)→ml, unit(s)→count `""`). Steps are HTML: strip tags,
   split into steps as given, keep the wording, drop "TIP:" fragments into the step text as-is.
   Oil/salt/pepper are rarely listed: add them as staples if the method uses them.
4. Hero image: download the JSON-LD `image` URL, then save with Pillow: thumbnail to 800px long edge, JPEG quality 80, `images/<id>.jpg`.

## Home inputs (dishes the human cooks without a recipe)
The human asked for these to be written from scratch. This is the one case where you write recipe content.
Each input is a dish name, sometimes with the human's own description in brackets. Follow that description exactly
(e.g. "bacon, hash browns, egg and tomato ketchup in a wrap" means those are the fillings).
1. Write a plain, everyday UK home version: common UK supermarket ingredients, no chef flourishes, no blog text,
   4–8 clear steps, realistic `time_minutes`. Shop-bought shortcuts are fine where a home cook would use them
   (jar pesto, gravy granules, frozen veg). Write both serving columns: `servings: {"base": 2, "available": [2, 4]}`.
2. `source: {"type":"home","brand":"Home","url":null}`. Add a first note:
   `{"text":"Written by Claude as a starting point. Adjust to how you make it.","fixed":false}`. No `substitution` flags needed.
3. `transcripts/<id>.md`: the dish name and the human's description, plus one line on what you based it on.
4. Image, from Wikimedia Commons only (openly licensed): search with the API, e.g.
   `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=<dish>%20filetype:bitmap&gsrlimit=15&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200`
   (User-Agent: `RecipeApp/1.0 (personal recipe app)`; never add an email). Download a few candidates and LOOK at them.
   Pick one that clearly shows the finished dish, appetising, plated, not a packet or a menu. Save as 800px JPEG q80 to
   `images/<id>.jpg` and add a note `{"text":"Photo: <file title>, <author>, <licence>, Wikimedia Commons","fixed":false}`.
   If nothing suitable exists, don't save an image; report `image: none` and the orchestrator makes a title tile.
5. If an input is a URL or PDF, it's a real recipe: transcribe it as a web input (brand = the publisher) instead.

## Both
- Never invent content. Branded sachets/pastes → apply the standard swaps in CLAUDE.md; anything else, choose a
  sensible UK supermarket equivalent, mark `substitution: true`, keep `original`, and report it.
  When the source states a sachet's weight/volume (web pages often do, e.g. "10 grams Chicken Stock Paste"), use it rather than a guess.
- Tags: 2–4 lowercase, main protein first (`chicken`, `beef`, `pork`, `lamb`, `fish`, `veggie`), then dish type/cuisine.
- Other agents run in parallel. Any helper script you write must have a name unique to your batch
  (e.g. `gen_<first-input>.py`), and never run a script you didn't write.
- Rotation: if a photo in `work/card-NNN/` is still sideways or upside down, rotate a copy for reading and say so in flags.
- Run `python tools/validate.py <id> [<id> ...]` on your recipes until 0 failed. Do **not** run build.py and don't
  touch files other than your own `transcripts/`, `recipes/`, `images/` outputs.

## Report back (keep it short, one block per recipe)
```
<input> -> <id> | <brand> | <title>
  subs: <original> → <swap>; ...
  estimates: <item> <value>; ...
  new aliases: "<seen>" → "<canonical>"
  flags: <anything unreadable, missing, ambiguous, or a possible duplicate>
```
