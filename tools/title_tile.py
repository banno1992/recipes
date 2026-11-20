"""Make a plain title tile as a stand-in hero image.
Usage: python tools/title_tile.py <id> "<Title>"   -> images/<id>.jpg (800x600)
Replace it with a real photo later (crop_hero.py or any 800px JPEG)."""
import os, sys, textwrap
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rid, title = sys.argv[1], sys.argv[2]
W, H = 800, 600
im = Image.new("RGB", (W, H), (194, 65, 12))  # app accent
d = ImageDraw.Draw(im)
try:
    font = ImageFont.truetype("arialbd.ttf", 64)
except Exception:
    font = ImageFont.load_default()
lines = textwrap.wrap(title, 18)
lh = 78
y = (H - lh * len(lines)) // 2
for line in lines:
    w = d.textlength(line, font=font) if hasattr(d, "textlength") else d.textsize(line, font=font)[0]
    d.text(((W - w) // 2, y), line, fill=(255, 255, 255), font=font)
    y += lh
im.save(os.path.join(ROOT, "images", rid + ".jpg"), quality=85)
print("tile", rid)
