"""Crop hero images from upright front photos. Usage: crop_hero.py <upright.jpg> <id> x0 y0 x1 y1 (fractions)"""
import sys
from PIL import Image
src, rid = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(float, sys.argv[3:7])
im = Image.open(src).convert('RGB')
w, h = im.size
im = im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))
im.thumbnail((800, 800), Image.LANCZOS)
im.save('images/%s.jpg' % rid, quality=80, optimize=True, progressive=True)
print(rid, im.size)
