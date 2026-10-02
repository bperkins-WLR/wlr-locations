#!/usr/bin/env python3
"""Stamp the current build date/time into index.html.

There is no build step for this app, so the stamp is written into the source
right before committing. Run it, then commit — the stamp reflects when the
build shipped, which is exactly what you compare against a phone's footer.

    python3 tools/stamp-build.py

Also versions the shared icons.js reference (index.html and admin.html) with
the same stamp, so an iPhone home-screen install that reloads after an update
cannot pair the new page with an old cached sprite.

Prints the stamp it wrote.
"""
import io, os, re, sys
from datetime import datetime
from zoneinfo import ZoneInfo

APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "WLR Location Photos Webapp")
P = os.path.join(APP, "index.html")

# Eastern time — the whole company is in ET, so a UTC stamp would just confuse.
# ZoneInfo follows daylight saving; a fixed -4 offset would run an hour fast
# all winter.
now = datetime.now(ZoneInfo("America/New_York"))
stamp = now.strftime("%Y-%m-%d %H:%M")

s = io.open(P, encoding="utf-8").read()
new, n = re.subn(r"const BUILD = '[\d: -]*';", f"const BUILD = '{stamp}';", s)
if n != 1:
    sys.exit(f"expected exactly one BUILD constant in index.html, found {n}")
io.open(P, "w", encoding="utf-8").write(new)

for page in ("index.html", "admin.html"):
    path = os.path.join(APP, page)
    s = io.open(path, encoding="utf-8").read()
    new, n = re.subn(r'src="icons\.js(\?v=\d+)?"', f'src="icons.js?v={now:%Y%m%d%H%M}"', s)
    if n != 1:
        sys.exit(f"expected exactly one icons.js script tag in {page}, found {n}")
    io.open(path, "w", encoding="utf-8").write(new)

print(f"stamped build {stamp}")
