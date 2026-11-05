"""Neutralize badges/plate in the W222 texture atlas; Pillow is required."""
import sys
from PIL import Image, ImageDraw
src, dest = sys.argv[1:]
im = Image.open(src).convert('RGBA')
if im.size != (1024, 1024):
    raise ValueError(f'Unexpected W222 atlas dimensions: {im.size}')
draw = ImageDraw.Draw(im)
# Steering-wheel emblem. Preserve the wheel's surrounding shading.
draw.ellipse((48, 394, 78, 425), fill=(158, 153, 153, 255))
# Generic blank license plate, without the photographed registration/markings.
draw.rectangle((261, 82, 410, 115), fill=(215, 214, 209, 255))
im.save(dest)
