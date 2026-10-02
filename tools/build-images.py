#!/usr/bin/env python3
"""Generate responsive AVIF/WebP variants for the location photos.

The 1920px JPEGs stay as-is: they remain the large source the lightbox uses on
big screens, and the final fallback for browsers with neither modern format.
Re-runnable — variants newer than their source are skipped.

Also rewrites the PHOTO_VER line in index.html with a short content hash of
each photo, which the app appends to photo URLs (?v=…). Replacing a photo thus
changes its address, so devices holding the old copy fetch the new one.

    python3 tools/build-images.py [--force]
"""
import sys, os, glob, re, json, hashlib
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

# Fingerprint every bundled photo into index.html. Hashing the source JPEG is
# enough: the variants are derived from it and change exactly when it does.
ver = {}
for src in srcs:
    m = re.search(r"images/(loc-\d+/0[12])\.jpg$", src)
    if m:
        with open(src, "rb") as f:
            ver[m.group(1)] = hashlib.sha256(f.read()).hexdigest()[:8]
html = open("index.html", encoding="utf-8").read()
line = "const PHOTO_VER = " + json.dumps(ver, separators=(",", ":")) + ";"
html, n = re.subn(r"^const PHOTO_VER = .*;$", lambda _: line, html, count=1, flags=re.M)
if n != 1:
    sys.exit("index.html: PHOTO_VER line not found")
open("index.html", "w", encoding="utf-8").write(html)
print(f"PHOTO_VER: {len(ver)} photos fingerprinted")
