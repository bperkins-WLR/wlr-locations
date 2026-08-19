#!/usr/bin/env python3
"""Pull street addresses and phone numbers from washluberepair.com.

The public site is WordPress; its Store Locator entries are a `stores` post
type, so the list comes from the REST API and each address is read off the
rendered page (ACF fields are not exposed over REST).

    python3 tools/scrape-addresses.py            # print a table
    python3 tools/scrape-addresses.py --json     # emit JSON

Deliberately does NOT edit index.html. Site store names do not map 1:1 to WLR
location numbers — "Gaithersburg - Rio Lube Center" is #5 Washingtonian, and
Gambrills has three co-located businesses — so the mapping is reviewed by hand.
"""
import json, re, sys, time, html, urllib.request

BASE = "https://www.washluberepair.com"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")   # default UA is 403'd by their WAF

def get(url):
    return urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40
    ).read().decode("utf-8", "replace")

def clean(a):
    a = re.sub(r"\s+", " ", a or "").replace(" ,", ",").strip().rstrip(",")
    return a.replace(", Maryland", ", MD").replace(", Pennsylvania", ", PA")

stores = json.loads(get(f"{BASE}/wp-json/wp/v2/stores?per_page=100&_fields=slug,link,title"))
rows = []
for i, s in enumerate(sorted(stores, key=lambda x: x["title"]["rendered"]), 1):
    body = get(s["link"])
    def grab(pat):
        m = re.search(pat, body, re.S)
        return html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip() if m else None
    rows.append({
        "name":  grab(r'<span class="store_name">(.*?)</span>') or html.unescape(s["title"]["rendered"]),
        "addr":  clean(grab(r'<span class="loc-content">(.*?)</span>')),
        "phone": grab(r'href="tel:([^"]+)"'),
        "url":   s["link"],
    })
    time.sleep(0.7)                                        # be gentle with their host

if "--json" in sys.argv:
    print(json.dumps(rows, indent=1))
else:
    for r in rows:
        print(f"{r['name']:42} {str(r['phone'] or ''):16} {r['addr']}")
    print(f"\n{sum(1 for r in rows if r['addr'])}/{len(rows)} addresses found")
