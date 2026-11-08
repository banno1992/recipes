"""Photo intake helpers. Work files go in work/ (gitignored).

  python tools/prep_photos.py sheets
      Orders inbox/*.jpg by EXIF DateTimeOriginal (fallback: filename), writes
      work/order.json and contact sheets work/sheets/sheet-NN.jpg with numbered
      thumbnails, for checking pairs and orientation at a glance.

  python tools/prep_photos.py upright work/plan.json
      plan.json: [{"id": "...", "front": N, "back": N, "rot_front": -90, "rot_back": 90}, ...]
      (N = index in order.json; rotation in degrees counter-clockwise, as PIL).
      Writes work/<id>/front.jpg, back.jpg and left/right halves of each,
      sized for reading small print.
"""
import json, os, sys, glob
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work")


def taken(path):
    try:
        exif = Image.open(path)._getexif() or {}
        return exif.get(36867) or exif.get(306) or ""
    except Exception:
        return ""


def sheets():
    files = sorted(glob.glob(os.path.join(ROOT, "inbox", "*.jpg")) + glob.glob(os.path.join(ROOT, "inbox", "*.jpeg")))
    files.sort(key=lambda p: (taken(p) or "~", os.path.basename(p)))
    order = [os.path.relpath(p, ROOT).replace("\\", "/") for p in files]
    os.makedirs(os.path.join(WORK, "sheets"), exist_ok=True)
    json.dump(order, open(os.path.join(WORK, "order.json"), "w"), indent=1)
    cols, rows, tw = 4, 4, 300
    per = cols * rows
    try:
        font = ImageFont.truetype("arialbd.ttf", 40)
    except Exception:
        font = ImageFont.load_default()
    for s in range(0, len(order), per):
        sheet = Image.new("RGB", (cols * tw, rows * tw), "white")
        for k, rel in enumerate(order[s:s + per]):
            im = Image.open(os.path.join(ROOT, rel)).convert("RGB")
            im.thumbnail((tw - 8, tw - 8))
            x, y = (k % cols) * tw, (k // cols) * tw
            sheet.paste(im, (x + 4, y + 4))
            d = ImageDraw.Draw(sheet)
            d.rectangle([x + 4, y + 4, x + 70, y + 50], fill="yellow")
            d.text((x + 8, y + 6), str(s + k), fill="black", font=font)
        sheet.save(os.path.join(WORK, "sheets", "sheet-%02d.jpg" % (s // per)), quality=80)
    print("%d photos, %d sheets" % (len(order), (len(order) + per - 1) // per))


def upright(plan_path):
    order = json.load(open(os.path.join(WORK, "order.json")))
    plan = json.load(open(plan_path))
    for c in plan:
        out = os.path.join(WORK, c["id"])
        os.makedirs(out, exist_ok=True)
        for side in ("front", "back"):
            if c.get(side) is None:
                continue
            im = Image.open(os.path.join(ROOT, order[c[side]])).convert("RGB")
            im = im.rotate(c.get("rot_" + side, 0), expand=True)
            full = im.copy()
            full.thumbnail((2000, 2000))
            full.save(os.path.join(out, side + ".jpg"), quality=85)
            w, h = im.size
            for name, box in (("left", (0, 0, w // 2 + w // 20, h)), ("right", (w // 2 - w // 20, 0, w, h))):
                half = im.crop(box)
                half.thumbnail((1600, 1600))
                half.save(os.path.join(out, "%s-%s.jpg" % (side, name)), quality=85)
    print("Prepared %d cards" % len(plan))


if __name__ == "__main__":
    if sys.argv[1] == "sheets":
        sheets()
    elif sys.argv[1] == "upright":
        upright(sys.argv[2])
