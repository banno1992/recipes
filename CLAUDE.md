# Recipe App — Build Spec

A personal offline web app (PWA) holding ~50–100 favourite meal-kit recipes (Gousto, HelloFresh etc.), rewritten into one consistent format. Used by two people on Android phones. Static site on GitHub Pages; the two phones share their picks and shopping list through Firebase (see Sync).

Core jobs:
1. Remind us of recipes we like but have forgotten (random meal picker).
2. Turn a week's picks into one combined shopping list with amounts.
3. Be easy to cook from (inline amounts, serving scaling, screen stays awake).

## Working style

- Solve problems yourself where a sensible person would. Only flag what genuinely needs a human decision.
- Never invent recipe content. Don't change the recipe beyond formatting, except for the specific substitutions and fixes allowed below, and record every one of those.
- Plain, no-fluff UI copy. No blog-style text anywhere.

## Folder structure

```
recipe-app/
  CLAUDE.md
  inbox/          # raw photos dropped here (gitignored)
  archive/        # raw photos moved here after processing (gitignored)
  transcripts/    # verbatim text of each card, one .md per recipe (gitignored)
  recipes/        # one JSON per recipe — the source of truth
  images/         # cropped, resized hero image per recipe
  data/recipes.json   # built from recipes/*.json by tools/build.py
  tools/          # build.py, validate.py, crop/resize helpers
  index.html, app.js, styles.css, manifest.json, sw.js
  REVIEW.md       # flags for the human after each batch
```

Raw photos and transcripts must never be committed. GitHub Pages publishes the whole repo.

### Privacy (password lock)

The site is public but its content is encrypted. `tools/build.py` encrypts all recipe data and images with AES-GCM, using a key derived from the passphrase in `.passphrase`. That file is gitignored and the human writes it. Never read it, print it or ask for it. The output goes to `vault/` (recipes.bin, i/<hash>.bin, meta.json). The app asks for the password once per phone and decrypts in the browser.

- **Only `vault/` and the app shell are committed.** `recipes/`, `images/`, `data/`, `transcripts/`, `work/` and `REVIEW.md` are gitignored and stay on this PC. Never commit plaintext recipe content or photos.
- **Recovery:** on a new machine, clone the repo, write `.passphrase`, then run `python tools/unvault.py`. That rebuilds `recipes/` and `images/`.
- **Changing the password:** edit `.passphrase` and run build.py. It makes a new key, and both phones will need the new password.
- **Testing locally:** don't build with a test passphrase (`RX_PASSPHRASE`). The next real build would then rotate the salt, which makes both phones ask for the password again. To test locally, ask the human to unlock the preview themselves, or just check that `data/recipes.json` is correct.

## Photo intake

- The photos come from a Pixel phone via a Google Photos download, as JPEGs (convert HEIC/other formats if any appear). Each card is shot front first, then back, in sequence.
- Order the photos by EXIF DateTimeOriginal, falling back to the filename. Pair them consecutively as (front, back).
- Verify each pair by content. The front has the title, hero photo and ingredients. The back has the method, usually with the title repeated. If a pair doesn't match (a missing shot, a duplicate, a single-sided card), fix it if the fix is obvious, otherwise flag it in REVIEW.md.
- Hero image: find the dish photo on the front and crop it with Pillow. Resize to 800px on the long edge and save as JPEG at quality 80 or WebP in `images/<id>.jpg`. Straighten or perspective-correct only if it's easy. Otherwise a clean crop is fine.

## Processing pipeline (per recipe)

1. **Transcribe** verbatim into `transcripts/<id>.md`, including both serving columns if present.
2. **Structure** the transcript into `recipes/<id>.json` using the schema below.
3. **Validate** with `tools/validate.py`:
   - every `{ref}` in a step exists in the ingredients;
   - every non-staple ingredient is used in at least one step (warn only);
   - every ingredient has a quantity, or is marked `to_taste`/staple;
   - every non-metric quantity has a metric equivalent;
   - the image file exists.
4. **Review** (orchestrator): check the JSON against the photos and resolve what can be resolved. Add anything that remains to REVIEW.md.

### Agents

- The main session (Opus) owns the schema, the pairing, the validation and the review.
- Spawn subagents using the **Sonnet** model for steps 1–2 and the hero crop, in batches of about 5 recipes each, all launched in parallel. Each agent's whole instruction is `tools/AGENT_BRIEF.md` plus its list of inputs. Keep that brief up to date when conventions change.
- After all batches finish:
  - run validate.py;
  - review the agents' reports and a contact sheet of the new hero images;
  - fix or flag anything wrong;
  - add new aliases to tools/ingredients.json;
  - update REVIEW.md;
  - move the photos from inbox/ to archive/.

### Card photo intake (tools)

1. `python tools/prep_photos.py sheets` orders inbox/ by EXIF time and writes numbered contact sheets to `work/sheets/`. Look at them to confirm the front/back pairs, spot duplicate shots, and choose each photo's rotation. PIL rotates counter-clockwise; the sheets show raw pixels.
2. Write `work/plan.json` as `[{"id":"card-NNN","front":N,"back":N+1,"rot_front":-90,"rot_back":90}, ...]`. Then run `python tools/prep_photos.py upright work/plan.json`, which writes `work/card-NNN/` with upright fronts and backs plus their halves.
3. Give the card folders to Sonnet agents in fives.
- The second batch (Nov 2026) had 134 photos. They were mostly portrait HelloFresh (front −90, back +90), but some were landscape: some shot upright (0), some upside down (180). Gousto fronts were +90 and Gousto backs either +90 or 0. The front and back of the same card can differ: for some landscape cards the front was upside down but the back was upright. Check each photo on the sheets rather than assuming.

### Importing from HelloFresh online

On request ("import 20 more chicken recipes", etc.):
1. Run `python tools/hf_pick.py --n 20 [--match "chicken|beef"] [--min-ratings 250]`. It reads HelloFresh UK category pages and ranks the recipes by average rating, requiring at least that many ratings. It skips anything already in recipes/ (by URL or title) and writes `work/hf_picks.json`. Show the human the list if they asked for a specific selection.
2. Spawn Sonnet agents in batches of 5 URLs, using `tools/AGENT_BRIEF.md` ("Web inputs"). They read only the page's schema.org Recipe JSON-LD and download the main image.
3. Review, validate, build and deploy as for cards. Web recipes have `source.type: "web"` and keep the URL so the original can be opened.
- "Mince" means beef or pork mince. Meat-free and sausage meatballs are excluded by default.
- Fetch politely: one page at a time per agent, and no crawling beyond the listed recipes.

### Pilot first

Before any bulk run, process only the pilot cards in inbox/ (a handful across different brands). Build the app far enough to show them. Then stop and ask the human to review. Update this spec with anything learned, and only then run the rest.

## Rewriting rules

- **Inline amounts:** steps reference ingredients by id, e.g. `"Add {i3} and stir"`. The app renders this as "Add 200g plain flour and stir". If a step uses only part of an ingredient, use `{i3:half}` or write the amount explicitly in a `{i3:100g}` form, and the renderer scales it.
- **Units:** keep the original measurement and add a metric equivalent if the original isn't metric.
  - Solids go to g, liquids to ml.
  - Leave tsp and tbsp as they are.
  - Countable items stay as counts ("1 red onion"). Add a gram weight if the card gives one.
  - Packs keep their stated weight, e.g. "1 pack chicken thighs (280g)".
  - Use standard conversions. Mark estimates with `"estimated": true`.
- **Branded sachets and pastes** ("Gousto spice blend", "stock paste sachet", "Bengali curry paste") get swapped for a logical real-world equivalent you can buy at a UK supermarket. Do this without asking. Examples: a stock paste sachet becomes "1 chicken stock pot"; a spice blend becomes "1 tsp ground cumin, ½ tsp smoked paprika" based on the dish and what the card says the blend contains. Store the original text in `original` and set `substitution: true`. List every substitution in REVIEW.md as an FYI, not as a question.
- **Staples:** oil, salt, pepper and water are `staple: true`. They show in the recipe but never in the shopping list.
- **Cupboard items** such as sugar, soy sauce, flour, butter and honey (often listed as "from your cupboard") are `cupboard: true`. They go in a "Check the cupboard" section of the shopping list.
- **Fixes:** fill a genuinely missing detail (oven temp, missing amount) only if it is unambiguous from the card itself, and record it in `notes` with `fixed: true`. Otherwise flag it.
- **Steps:** keep the card's wording and order. You may split a long step or tidy the grammar. Add `timer_seconds` where a step has an explicit time.

## Schema (`recipes/<id>.json`)

```json
{
  "id": "chicken-katsu-curry",
  "title": "Chicken Katsu Curry",
  "source": { "type": "card", "brand": "Gousto", "url": null },
  "image": "images/chicken-katsu-curry.jpg",
  "time_minutes": 35,
  "tags": ["chicken", "curry"],
  "servings": { "base": 2, "available": [2, 4] },
  "ingredients": [
    {
      "id": "i1",
      "name": "chicken thigh",
      "display": "chicken thigh fillets",
      "qty": {
        "2": { "amount": 280, "unit": "g" },
        "4": { "amount": 560, "unit": "g" }
      },
      "original": "1 pack chicken thighs (280g)",
      "category": "meat-fish",
      "staple": false,
      "cupboard": false,
      "substitution": false,
      "estimated": false,
      "optional": false
    }
  ],
  "steps": [
    { "n": 1, "text": "Slice {i1} into strips.", "timer_seconds": null }
  ],
  "notes": [{ "text": "...", "fixed": false }]
}
```

- `name` is the canonical shopping name: lowercase, singular, with no prep words ("red onion", not "red onions, finely diced"). Consistent canonical names are what make the shopping list aggregation, and the future Ocado ordering, work. Keep a `tools/ingredients.json` alias map, e.g. "spring onions" → "spring onion" and "scallion" → "spring onion".
- `category` is one of: `fruit-veg`, `meat-fish`, `dairy-eggs`, `bakery`, `cupboard`, `herbs-spices`, `frozen`, `other`.
- Scaling: use the matching serving column if there is one. Otherwise scale linearly from the nearest available column. Round sensibly: whole counts for countable items, and 5g/5ml steps for weights.

### Conventions settled in the pilot

- **Photos** arrive sideways (Pixel EXIF orientation is 1, but the cards are shot landscape). Rotate them upright before transcribing and split them into left/right halves so the small text is readable. HelloFresh fronts rotate −90° and backs +90°. Both Gousto sides rotate +90°.
- **Gousto** puts the ingredient quantities on the front ("for 2 [double for 4]"), so `available` is `[2, 4]`. Gousto steps have no headings, so `title` is `null`. HelloFresh has a 2P/3P/4P table on the back.
- **Extra fields:** `subtitle` (the card's "with …" line), `steps[].title`, and `ingredients[].to_taste`.
- **Step tokens:** `{iN}` gives the full amount and name. `{iN:half}`, `{iN:third}` and `{iN:quarter}` give a fraction of the amount. `{iN:rest}` gives "the remaining X". `{iN:name}` gives the name only. `{iN:100g}` gives an explicit amount scaled from base servings.
- **Units:** countable items use `unit: ""` with a singular `display`, and the app pluralises it. Bunches use `"bunch"`. A non-metric unit carries `metric: {amount, unit}`.
- **Staples** have `qty: null`, unless the card prints an amount (water for orzo or couscous, olive oil for a dressing). Then they keep the qty, show in the ingredient list, and still stay off the shopping list.
- **Fresh herbs** go in `fruit-veg`. `herbs-spices` is for dried spices and seeds.
- **Standard swaps** (all `estimated: true`):
  - Soy sauce sachet → 1 tbsp soy sauce
  - Ketjap manis sachet → 1½ tbsp ketjap manis
  - Honey sachet → 1 tsp honey
  - Easy Ginger sachet → 2 tsp ginger paste
  - Chicken stock powder sachet → ½ chicken stock pot
  - Harissa sachet → 1 tbsp harissa paste
  - Turmeric sachet → 2 tsp ground turmeric
- **Batches:** run `tools/build.py` after every change. It applies `tools/ingredients.json` aliases, writes `data/recipes.json`, and bumps the `sw.js` cache version and image list.
- **Local preview:** `python -m http.server 8765` from the repo root (`.claude/launch.json`).

## App

Plain HTML/CSS/JS with no framework and no build step beyond `tools/build.py`, which writes `data/recipes.json`. It must be mobile-first, work fully offline, and look clean and simple.

- **Picker (home):** shows 5 or 10 random recipe tiles (toggle), each with a photo and title.
  - Tap the lock on a tile to keep it, and Reroll to replace the unlocked ones.
  - Tap a tile to add it to "This week" and set its servings.
  - Weight the random draw towards recipes not picked recently. Keep the pick history (shared between phones, see Sync), since the main goal is surfacing forgotten favourites.
- **This week:** the chosen meals with their servings, and a "Shopping list" button.
- **Shopping list:** combines all chosen meals.
  - Merge items by canonical `name`, converting g↔kg and ml↔l. Keep counts separate from weights.
  - Group by category in supermarket order.
  - Leave staples out. Put cupboard items in a separate "Check the cupboard" section.
  - Make each item a tickable checkbox; ticks are shared between phones.
  - Add a Share button using the Web Share API with plain text, so it works on WhatsApp.
- **All recipes:** a searchable grid with a filter by brand or tag.
- **Recipe view:** hero image, servings stepper, ingredients, then steps with inline scaled amounts.
  - The screen stays awake while it's open, using the Wake Lock API. Re-acquire the lock on `visibilitychange` and show a small indicator.
  - Tap a step to mark it done, and tap a timer to start it.
- **PWA:** add `manifest.json` and a service worker that caches the app, the data and the images, so the whole app works offline after the first load. Make it installable to the Android home screen. Bump the cache version on every deploy.

## Sync

Both phones share one Firestore document (`shared/home`) in the Firebase project `recipes-6a608` (Spark free plan, europe-west2). `sync.js` holds the Firebase config and talks to Firestore; `app.js` keeps localStorage as its working copy and pushes each change through `sync.merge()`/`sync.replace()`.

- **Shared:** `week` (`{id: {servings, t}}`, ordered by `t`), `picks`, `locks` (`{id: true}`), `checks` (`{key: true}`), `history` (`{id: ms}`), `pickSize`.
- **Per phone:** the vault key, default servings, per-recipe servings (`rs.*`) and ticked steps (`done.*`).
- **Merging:** item-level. Locks, ticks, week items and history merge key by key; `picks` and whole-field clears replace the field. The last write to the same item wins.
- **Sign-in:** Google, once per phone (popup, redirect fallback). Signing in is optional; signed out, the app works locally as before.
- **First sign-in:** if the shared doc doesn't exist yet the phone uploads its local state; otherwise the shared state replaces the phone's, except that newer local pick history is merged in. The phone waits for the server before deciding, so an empty offline cache can't overwrite the shared state.
- **Offline:** Firestore's persistent cache queues writes and sends them when back online. The service worker caches the Firebase SDK files from gstatic.
- **Access:** Firestore security rules allow `shared/home` only for verified Google accounts in an email allow-list. Everything else is denied. Edit the list in the Firebase console → Firestore → Rules. Recipe content and photos never go to Firebase; they stay in the encrypted vault.
- The Firebase web config in `sync.js` is public by design. Authorized domains for sign-in: `localhost`, `banno1992.github.io`.

## Hosting

- Use a public GitHub repo with GitHub Pages serving from the root of `main`.
- The human is new to git. Do the git and `gh` work for them, explaining only what they must do themselves (e.g. `gh auth login` in the browser).
- Deploying means: build, validate, commit, push. Then give them the live URL.
- Git and gh live in `C:\Program Files\Git\cmd` and `C:\Program Files\GitHub CLI`, which aren't on the tool shell's PATH, so add them to `$env:Path` in each call. Write commit messages to a file without a BOM and use `git commit -F`.

### Home recipes (written from scratch)

The human can list dishes they cook without a recipe and ask for them to be written. This is the only exception to "never invent recipe content".
- Agents follow "Home inputs" in `tools/AGENT_BRIEF.md`.
- They use `source.type: "home"` and brand "Home", and the recipe's first note says it was written by Claude as a starting point.
- Photos come only from Wikimedia Commons (openly licensed), credited in the notes. Otherwise `python tools/title_tile.py <id> "<Title>"` makes a stand-in tile.
- A recipe the human says exists somewhere (a note, a PDF) is never written from scratch. Ask for it, or transcribe the source.

### Cleaning up card hero photos (Gemini)

Card hero photos are often washed out. The human chose to regenerate them with Nano Banana in the Gemini web app (their Google AI Pro plan, not the API), a few per day as their usage allows. Only `source.type: "card"` images are in the queue.
- `python tools/gemini_thumbs.py next N` lists the next images, most washed out first. In Claude in Chrome, open a new Gemini chat for each one, pick the image model, upload the image with the text of `tools/gemini_prompt.txt`, and download the result.
- Compare the result to the original before accepting. Reject it if any food, garnish or plate has changed. Then run `gemini_thumbs.py accept <id> <file>` or `reject <id> <why>`. Accepting backs up the original to `images/originals/` and centre-crops the result to the original's size.
- After each day's batch, run `gemini_thumbs.py sheet` and show the human, then build and deploy.
- `revert <id>` restores an original. `status` shows progress. The state is in `work/gemini/state.json`.

## Adding recipes later

- **Photo:** drop it in inbox/ and run the same pipeline.
- **URL:** fetch the page and prefer its embedded schema.org `Recipe` JSON-LD. Take only the title, ingredients, method, servings, time and main image, and ignore all blog content. Apply the same rewriting rules and schema, with `source.type: "web"` and the URL.

## Future (do not build yet)

Ocado ordering. The workflow would be: generate the shopping list, the human approves it, then Claude adds the items to the Ocado basket in a browser. Nothing is ever checked out without approval. Keep the canonical names clean so this stays possible.
