"""Queue for cleaning up card hero photos with Gemini (Nano Banana) in the browser.

The Gemini step itself is done by hand or by Claude in Chrome on gemini.google.com,
a few images per day within the plan's limits. This script tracks what's done
and swaps the results in safely.

  python tools/gemini_thumbs.py status
  python tools/gemini_thumbs.py next [N]          # next N card images to send (most washed-out first)
  python tools/gemini_thumbs.py accept <id> <file> # back up original, fit result, replace images/<id>.jpg
  python tools/gemini_thumbs.py reject <id> [why]  # mark as tried and not good enough (stays original)
  python tools/gemini_thumbs.py retry <id>         # put a rejected one back in the queue
  python tools/gemini_thumbs.py revert <id>        # restore the original photo
  python tools/gemini_thumbs.py sheet [id ...]     # before/after sheet -> work/gemini/sheet.jpg

Originals are kept in images/originals/. State is in work/gemini/state.json.
Run tools/build.py after accepting images.
"""
import json
import shutil
import sys
from datetime import date
from pathlib import Path

from PIL import Image, ImageOps, ImageStat, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
ORIG = IMAGES / "originals"
WORK = ROOT / "work" / "gemini"
STATE = WORK / "state.json"
LONG_EDGE = 800


def load_state():
    if STATE.exists():
        return json.loads(STATE.read_text(encoding="utf-8"))
    return {}


def save_state(s):
    WORK.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(s, indent=2), encoding="utf-8")


def card_recipes():
    out = {}
    for f in sorted((ROOT / "recipes").glob("*.json")):
        r = json.loads(f.read_text(encoding="utf-8"))
        if r.get("source", {}).get("type") == "card":
            out[r["id"]] = r["title"]
    return out


def original_path(rid):
    backup = ORIG / f"{rid}.jpg"
    return backup if backup.exists() else IMAGES / f"{rid}.jpg"


def washout(path):
    """Lower = flatter/more washed out (luminance spread)."""
    with Image.open(path) as im:
        g = im.convert("L").resize((200, 200))
        return ImageStat.Stat(g).stddev[0]


def cmd_status():
    s, cards = load_state(), card_recipes()
    counts = {"done": 0, "rejected": 0}
    for v in s.values():
        counts[v["status"]] = counts.get(v["status"], 0) + 1
    pending = len([c for c in cards if c not in s])
    print(f"card recipes: {len(cards)}  done: {counts['done']}  rejected: {counts['rejected']}  pending: {pending}")
    today = [k for k, v in s.items() if v.get("date") == date.today().isoformat()]
    print(f"processed today: {len(today)}")


def cmd_next(n=5):
    s, cards = load_state(), card_recipes()
    pending = [c for c in cards if c not in s and (IMAGES / f"{c}.jpg").exists()]
    pending.sort(key=lambda c: washout(original_path(c)))
    for c in pending[:n]:
        print(f"{c}\t{cards[c]}\t{original_path(c)}")


def fit_to(result, w, h):
    """Centre-crop result to the original's aspect ratio, then resize to w x h."""
    result = ImageOps.exif_transpose(result).convert("RGB")
    return ImageOps.fit(result, (w, h), Image.LANCZOS)


def cmd_accept(rid, file):
    src = Path(file)
    cur = IMAGES / f"{rid}.jpg"
    if not cur.exists():
        sys.exit(f"no image for {rid}")
    ORIG.mkdir(parents=True, exist_ok=True)
    backup = ORIG / f"{rid}.jpg"
    if not backup.exists():
        shutil.copy2(cur, backup)
    with Image.open(backup) as o:
        w, h = o.size
    scale = LONG_EDGE / max(w, h)
    w, h = round(w * scale), round(h * scale)
    with Image.open(src) as r:
        out = fit_to(r, w, h)
    out.save(cur, "JPEG", quality=80, optimize=True)
    keep = WORK / "results" / f"{rid}{src.suffix.lower()}"
    keep.parent.mkdir(parents=True, exist_ok=True)
    if src.resolve() != keep.resolve():
        shutil.copy2(src, keep)
    s = load_state()
    s[rid] = {"status": "done", "date": date.today().isoformat()}
    save_state(s)
    print(f"accepted {rid} ({w}x{h})")


def cmd_reject(rid, why=""):
    s = load_state()
    s[rid] = {"status": "rejected", "date": date.today().isoformat(), "why": why}
    save_state(s)
    print(f"rejected {rid}")


def cmd_retry(rid):
    s = load_state()
    s.pop(rid, None)
    save_state(s)
    print(f"{rid} back in queue")


def cmd_revert(rid):
    backup = ORIG / f"{rid}.jpg"
    if not backup.exists():
        sys.exit(f"no original backed up for {rid}")
    shutil.copy2(backup, IMAGES / f"{rid}.jpg")
    s = load_state()
    s[rid] = {"status": "rejected", "date": date.today().isoformat(), "why": "reverted"}
    save_state(s)
    print(f"reverted {rid}")


def cmd_compare(rid, file):
    """Side-by-side of the original and a candidate result -> work/gemini/compare.jpg."""
    tile = 480
    out = Image.new("RGB", (tile * 2 + 30, tile + 20), "white")
    for i, p in enumerate([original_path(rid), Path(file)]):
        with Image.open(p) as im:
            im = im.convert("RGB")
            im.thumbnail((tile, tile))
            out.paste(im, (10 + i * (tile + 10), 10))
    WORK.mkdir(parents=True, exist_ok=True)
    dest = WORK / "compare.jpg"
    out.save(dest, "JPEG", quality=85)
    print(dest)


def cmd_sheet(ids):
    s = load_state()
    if not ids:
        ids = [k for k, v in s.items() if v["status"] == "done"][-10:]
    if not ids:
        sys.exit("nothing to show")
    tile = 360
    rows = []
    for rid in ids:
        pair = Image.new("RGB", (tile * 2 + 30, tile + 30), "white")
        for i, p in enumerate([ORIG / f"{rid}.jpg", IMAGES / f"{rid}.jpg"]):
            if p.exists():
                with Image.open(p) as im:
                    im = im.convert("RGB")
                    im.thumbnail((tile, tile))
                    pair.paste(im, (10 + i * (tile + 10), 25))
        ImageDraw.Draw(pair).text((10, 6), f"{rid}   (before | after)", fill="black")
        rows.append(pair)
    sheet = Image.new("RGB", (rows[0].width, sum(r.height for r in rows)), "white")
    y = 0
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height
    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / "sheet.jpg"
    sheet.save(out, "JPEG", quality=85)
    print(out)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] == "status":
        cmd_status()
    elif a[0] == "next":
        cmd_next(int(a[1]) if len(a) > 1 else 5)
    elif a[0] == "accept" and len(a) == 3:
        cmd_accept(a[1], a[2])
    elif a[0] == "reject" and len(a) >= 2:
        cmd_reject(a[1], " ".join(a[2:]))
    elif a[0] == "retry" and len(a) == 2:
        cmd_retry(a[1])
    elif a[0] == "revert" and len(a) == 2:
        cmd_revert(a[1])
    elif a[0] == "compare" and len(a) == 3:
        cmd_compare(a[1], a[2])
    elif a[0] == "sheet":
        cmd_sheet(a[1:])
    else:
        print(__doc__)
