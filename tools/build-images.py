#!/usr/bin/env python3
"""Generate responsive AVIF/WebP variants for the location photos.

The 1920px JPEGs stay as-is: they remain the large source the lightbox uses on
big screens, and the final fallback for browsers with neither modern format.
Re-runnable — variants newer than their source are skipped.

    python3 tools/build-images.py [--force]
"""
import sys, os, glob, re
from PIL import Image

# Resolve against the deployed app folder so this runs from anywhere.
APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "WLR Location Photos Webapp")
os.chdir(APP)

WIDTHS = (480, 960)
FORMATS = (("AVIF", "avif", {"quality": 52}),
           ("WEBP", "webp", {"quality": 78, "method": 6}))
force = "--force" in sys.argv

srcs = sorted(glob.glob("images/loc-*/0[12].jpg"),
              key=lambda p: (int(re.search(r"loc-(\d+)", p).group(1)), p))
srcs += [p for p in ("images/tase-coming-soon.jpg",) if os.path.exists(p)]

made = skipped = 0
saved_from = saved_to = 0
for src in srcs:
    stem = os.path.splitext(src)[0]
    im = None
    for w in WIDTHS:
        for pil_fmt, ext, opts in FORMATS:
            out = f"{stem}-{w}.{ext}"
            if not force and os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src):
                skipped += 1; continue
            if im is None:
                im = Image.open(src).convert("RGB")
            im.resize((w, round(w * im.height / im.width)), Image.LANCZOS).save(out, pil_fmt, **opts)
            made += 1
    saved_from += os.path.getsize(src)
    saved_to += os.path.getsize(f"{stem}-960.avif")

print(f"{len(srcs)} sources · {made} variants written, {skipped} up to date")
print(f"960w AVIF vs 1920w JPEG: {saved_from/1048576:.1f} MB -> {saved_to/1048576:.1f} MB "
      f"({100 - saved_to/saved_from*100:.0f}% smaller)")
