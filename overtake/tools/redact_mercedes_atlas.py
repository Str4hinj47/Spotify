"""Neutralize badges/plate in the W222 texture atlas; Pillow is required."""
import sys
from PIL import Image, ImageDraw
src, dest = sys.argv[1:]
im = Image.open(src).convert('RGBA')
if im.width != im.height or im.width not in (1024, 4096):
    raise ValueError(f'Unexpected W222 atlas dimensions: {im.size}')
scale = im.width / 1024
def scaled(box):
    return tuple(round(x * scale) for x in box)
draw = ImageDraw.Draw(im)
# Steering-wheel emblem. Preserve the wheel's surrounding shading.
draw.ellipse(scaled((48, 394, 78, 425)), fill=(158, 153, 153, 255))
# Generic blank license plate, without the photographed registration/markings.
draw.rectangle(scaled((261, 82, 410, 115)), fill=(215, 214, 209, 255))
im.save(dest)
