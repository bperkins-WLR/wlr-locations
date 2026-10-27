#!/usr/bin/env python3
"""Prepare a store photo for the gallery: crop to 3:2, resize to 1920x1280 and
burn in the "#NN" plate every location photo carries in its top-left corner.

    python3 tools/prepare-photo.py SOURCE NUM SLOT [--bias 0.5] [--out PATH]

SLOT is 01 (exterior), 02 (interior) or 03 (aerial). --bias says where to crop
along the axis that is too long: 0 keeps the top (or left) edge, 1 the bottom
(or right), 0.5 the centre. Writes src/assets/locations/loc-NN/SLOT.jpg unless
--out is given. Needs Pillow (pip install pillow); runs on the Mac, not in the
Vercel build.

The plate matches the existing photos exactly: anchored at (23, 24), 67px tall,
161px wide for two digits (126 for one), black at 175/255 with a 14px corner
radius, white Arial Bold 46 centred.
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None          # the shoots are ~90 MP
W, H = 1920, 1280
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "WLR Location Photos Webapp")

def crop_3x2(im, bias):
    w, h = im.size
    if w / h > W / H:                  # too wide: trim left/right
        cw = round(h * W / H); x = round((w - cw) * bias)
        return im.crop((x, 0, x + cw, h))
    ch = round(w * H / W); y = round((h - ch) * bias)   # too tall: trim top/bottom
    return im.crop((0, y, w, y + ch))

def burn_plate(im, num):
    label = f"#{num}"
    pw = 161 if len(label) >= 3 else 126
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    d.rounded_rectangle([23, 24, 23 + pw - 1, 24 + 67 - 1], radius=14, fill=(0, 0, 0, 175))
    d.text((23 + pw / 2, 24 + 67 / 2), label, font=ImageFont.truetype(FONT, 46),
           fill=(255, 255, 255, 255), anchor="mm")
    return Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("source"); ap.add_argument("num", type=int)
    ap.add_argument("slot", choices=["01", "02", "03"])
    ap.add_argument("--bias", type=float, default=0.5)
    ap.add_argument("--out")
    a = ap.parse_args()
    im = Image.open(a.source)
    im.draft("RGB", (W * 2, H * 2))   # decode big JPEGs at a reduced size, much faster
    im = crop_3x2(im.convert("RGB"), a.bias).resize((W, H), Image.LANCZOS)
    im = burn_plate(im, a.num)
    out = a.out or os.path.join(APP, "src", "assets", "locations", f"loc-{a.num:02d}", f"{a.slot}.jpg")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, quality=90, optimize=True, progressive=True)
    print(f"wrote {out} ({os.path.getsize(out) // 1024} KB)")

if __name__ == "__main__":
    main()
