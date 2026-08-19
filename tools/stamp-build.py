#!/usr/bin/env python3
"""Stamp the current build date/time into index.html.

There is no build step for this app, so the stamp is written into the source
right before committing. Run it, then commit — the stamp reflects when the
build shipped, which is exactly what you compare against a phone's footer.

    python3 tools/stamp-build.py

Prints the stamp it wrote.
"""
import io, os, re, sys
from datetime import datetime, timezone, timedelta

APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "WLR Location Photos Webapp")
P = os.path.join(APP, "index.html")

# Eastern time — the whole company is in ET, so a UTC stamp would just confuse.
et = timezone(timedelta(hours=-4))
stamp = datetime.now(timezone.utc).astimezone(et).strftime("%Y-%m-%d %H:%M")

s = io.open(P, encoding="utf-8").read()
new, n = re.subn(r"const BUILD = '[^']*';", f"const BUILD = '{stamp}';", s)
if n != 1:
    sys.exit(f"expected exactly one BUILD constant in index.html, found {n}")
io.open(P, "w", encoding="utf-8").write(new)
print(f"stamped build {stamp}")
