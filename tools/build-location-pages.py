#!/usr/bin/env python3
"""Generate per-location share stubs and their Open Graph card images.

This is a static site, so there is no server to inject per-location tags for a
?loc= query. Instead each location gets a tiny page at l/NN.html carrying its
own og: tags, which immediately forwards to index.html?loc=NN. Crawlers read
the tags without following the redirect; people land in the app.

    python3 tools/build-location-pages.py

Writes: WLR Location Photos Webapp/l/NN.html and og/NN.jpg
"""
import io, os, re, json, html

APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "WLR Location Photos Webapp")
os.chdir(APP)
SITE = "https://wlr-locations.vercel.app"
OG_W, OG_H = 1200, 630

# Pull the location list straight out of index.html so this cannot drift.
src = io.open("index.html", encoding="utf-8").read()
block = src[src.index("const locations = ["): src.index("\n];", src.index("const locations = ["))]
TYPE_FULL = {"TLC": "The Lube Center", "TAS": "The Auto Spa",
             "TAR": "The Auto Repair", "TASE": "The Auto Spa Express"}
locs = []
for m in re.finditer(r"\{ num: *(\d+),\s*name:\"([^\"]*)\".*?type:\"([^\"]*)\".*?city:\"([^\"]*)\""
                     r".*?state:\"([^\"]*)\"(.*?)\}", block, re.S):
    num, name, typ, city, state, rest = m.groups()
    locs.append({"num": int(num), "name": name, "type": typ, "city": city, "state": state,
                 "hidden": "hidden:true" in rest.replace(" ", ""),
                 "numOverride": (lambda o: int(o.group(1)) if o else None)(re.search(r"numOverride: *(\d+)", rest))})
print(f"{len(locs)} locations parsed from index.html")

os.makedirs("l", exist_ok=True)
os.makedirs("og", exist_ok=True)

# ── Open Graph card: the location's own exterior photo, cropped to 1.91:1 ──
from PIL import Image
made_img = 0
for loc in locs:
    dn = loc["numOverride"] or loc["num"]
    src_jpg = f"images/loc-{dn:02d}/01.jpg"
    out = f"og/{dn:02d}.jpg"
    if not os.path.exists(src_jpg):
        continue
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src_jpg):
        continue
    im = Image.open(src_jpg).convert("RGB")
    scale = max(OG_W / im.width, OG_H / im.height)
    r = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (r.width - OG_W) // 2
    top = max(0, int((r.height - OG_H) * 0.4))
    r.crop((left, top, left + OG_W, top + OG_H)).save(out, "JPEG", quality=62, optimize=True, progressive=True)
    made_img += 1

# ── stub pages ──
TPL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link rel="canonical" href="{app}">
<meta name="description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="WLR Automotive Group">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{share}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="{w}">
<meta property="og:image:height" content="{h}">
<meta name="twitter:card" content="summary_large_image">
<!-- Crawlers stop at the tags above; people are forwarded into the app. -->
<meta http-equiv="refresh" content="0; url={app_rel}">
<script>location.replace({app_js});</script>
</head>
<body style="margin:0;background:#0d3268;color:#fff;font-family:system-ui,sans-serif">
<p style="padding:24px">Opening {name}… <a href="{app_rel}" style="color:#FADC00">Continue</a></p>
</body>
</html>
"""
made = 0
for loc in locs:
    dn = loc["numOverride"] or loc["num"]
    label = f"#{dn:02d} {loc['name']}"
    title = f"{label} — WLR Automotive Group"
    status = "Coming soon" if loc["hidden"] else TYPE_FULL.get(loc["type"], "")
    desc = f"{status} · {loc['city']}, {loc['state']}. Photos, hours, ratings and team."
    img = f"{SITE}/og/{dn:02d}.jpg" if os.path.exists(f"og/{dn:02d}.jpg") else f"{SITE}/og-image.jpg"
    app_rel = f"../index.html?loc={loc['num']}"
    page = TPL.format(title=html.escape(title), desc=html.escape(desc), name=html.escape(loc["name"]),
                      app=f"{SITE}/index.html?loc={loc['num']}", share=f"{SITE}/l/{dn:02d}.html",
                      img=img, w=OG_W, h=OG_H, app_rel=app_rel, app_js=json.dumps(app_rel))
    io.open(f"l/{dn:02d}.html", "w", encoding="utf-8").write(page)
    made += 1

print(f"{made} stub pages written to l/, {made_img} new OG cards in og/")
