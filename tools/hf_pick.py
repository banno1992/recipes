"""Pick top-rated HelloFresh UK recipes to import.

  python tools/hf_pick.py [--n 30] [--min-ratings 250] [--match "chicken|beef|mince|meatball"]
                          [--exclude "meat-free|veggie|plant|sausage"]

Reads HelloFresh's public category pages (the recipe lists embedded in each page),
keeps recipes whose name matches --match, have at least --min-ratings ratings,
and aren't already in recipes/ (by source URL or by title). Sorts by average rating
and writes the top --n to work/hf_picks.json (url, name, rating, count).
Only the listed recipes are used; this doesn't crawl the whole site.
"""
import argparse, glob, json, os, re, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36"}
PAGES = ["chicken-recipes", "beef-recipes", "meat-recipes/chicken", "meat-recipes/beef", "meat-recipes/pork",
         "mince-recipes", "quick-recipes", "family-recipes", "easy-recipes", "popular-recipes"]


def listing(slug):
    url = "https://www.hellofresh.co.uk/recipes/" + slug
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8")
    except Exception:
        return []
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    found = []

    def walk(o):
        if isinstance(o, dict):
            if "recipeId" in o and "ratingsCount" in o and "websiteUrl" in o:
                found.append(o)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    if m:
        walk(json.loads(m.group(1)))
    return found


def norm(t):
    return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=30)
    ap.add_argument("--min-ratings", type=int, default=250)
    ap.add_argument("--match", default="chicken|beef|mince|meatball")
    ap.add_argument("--exclude", default="meat-free|veggie|plant|sausage")
    a = ap.parse_args()

    have_urls, have_titles = set(), set()
    for p in glob.glob(os.path.join(ROOT, "recipes", "*.json")):
        r = json.load(open(p, encoding="utf-8"))
        have_titles.add(norm(r["title"]))
        if r.get("source", {}).get("url"):
            have_urls.add(r["source"]["url"].split("?")[0])

    seen = {}
    for slug in PAGES:
        for r in listing(slug):
            if not isinstance(r.get("websiteUrl"), str) or not r.get("name"):
                continue
            seen.setdefault(r["websiteUrl"].split("?")[0], r)
    picks, names = [], set()
    for url, r in seen.items():
        name = r["name"].strip()
        if r.get("isAddon") or (r.get("ratingsCount") or 0) < a.min_ratings:
            continue
        if not re.search(a.match, name, re.I) or re.search(a.exclude, name, re.I):
            continue
        if url in have_urls or norm(name) in have_titles or norm(name) in names:
            continue
        names.add(norm(name))
        picks.append({"url": url, "name": name, "rating": round(r.get("adjustedRating") or 0, 2), "count": r["ratingsCount"]})
    picks.sort(key=lambda x: (-x["rating"], -x["count"]))
    picks = picks[:a.n]
    os.makedirs(os.path.join(ROOT, "work"), exist_ok=True)
    json.dump(picks, open(os.path.join(ROOT, "work", "hf_picks.json"), "w"), indent=1)
    for p in picks:
        print("%.2f %5d  %s" % (p["rating"], p["count"], p["name"]))
    print("%d picks -> work/hf_picks.json (from %d listed recipes)" % (len(picks), len(seen)))


if __name__ == "__main__":
    main()
