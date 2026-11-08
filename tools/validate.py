"""Validate recipes/*.json. Usage: python tools/validate.py [id ...]
Exit code 1 if any ERROR. WARN lines are informational."""
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATEGORIES = {"fruit-veg", "meat-fish", "dairy-eggs", "bakery", "cupboard", "herbs-spices", "frozen", "other"}
METRIC_OR_SPOON = {"g", "kg", "ml", "l", "tsp", "tbsp"}
COUNT_UNITS = {"", "bunch", "pinch"}
TOKEN = re.compile(r"\{(i\d+)(?::([^}]+))?\}")
MODS = {"half", "third", "quarter", "rest", "name"}
REQUIRED = ["id", "title", "source", "image", "servings", "ingredients", "steps"]


def check(path):
    errs, warns = [], []
    try:
        r = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        return ["invalid JSON: %s" % e], []
    rid = os.path.splitext(os.path.basename(path))[0]
    for k in REQUIRED:
        if k not in r:
            errs.append("missing field '%s'" % k)
    if errs:
        return errs, warns
    if r["id"] != rid:
        errs.append("id '%s' does not match filename" % r["id"])
    if not os.path.exists(os.path.join(ROOT, r["image"])):
        errs.append("image missing: %s" % r["image"])
    avail = [str(s) for s in r["servings"].get("available", [])]
    if str(r["servings"].get("base")) not in avail:
        errs.append("servings.base not in available")

    ings = {}
    for ing in r["ingredients"]:
        iid = ing.get("id")
        if iid in ings:
            errs.append("duplicate ingredient id %s" % iid)
        ings[iid] = ing
        label = "%s (%s)" % (iid, ing.get("name"))
        if ing.get("name") != (ing.get("name") or "").lower():
            warns.append("%s name should be lowercase" % label)
        if ing.get("category") not in CATEGORIES:
            errs.append("%s bad category '%s'" % (label, ing.get("category")))
        q = ing.get("qty")
        if not q:
            if not (ing.get("staple") or ing.get("to_taste") or ing.get("optional")):
                errs.append("%s has no quantity and is not staple/to_taste" % label)
            continue
        for s in avail:
            if s not in q:
                errs.append("%s missing qty for %s servings" % (label, s))
        for s, v in q.items():
            u = v.get("unit", "")
            if not isinstance(v.get("amount"), (int, float)):
                errs.append("%s qty[%s] amount not a number" % (label, s))
            if u not in METRIC_OR_SPOON and u not in COUNT_UNITS:
                if not v.get("metric"):
                    errs.append("%s qty[%s] unit '%s' has no metric equivalent" % (label, s, u))

    used = set()
    for st in r["steps"]:
        for iid, mod in TOKEN.findall(st.get("text", "")):
            if iid not in ings:
                errs.append("step %s references unknown %s" % (st.get("n"), iid))
            if mod and mod not in MODS and not re.match(r"^[\d.]+\s*\w*$", mod):
                errs.append("step %s bad modifier '%s'" % (st.get("n"), mod))
            if mod != "name":
                used.add(iid)
            elif iid not in used:
                used.add(iid + ":nameonly")
        if "{" in TOKEN.sub("", st.get("text", "")):
            errs.append("step %s has a malformed {token}" % st.get("n"))
    for iid, ing in ings.items():
        if ing.get("staple"):
            continue
        if iid not in used:
            if iid + ":nameonly" in used:
                warns.append("%s (%s) only referenced by name, amount never shown in method" % (iid, ing["name"]))
            else:
                warns.append("%s (%s) not used in any step" % (iid, ing["name"]))
    for n in r.get("notes", []):
        if n.get("text", "").startswith("CHECK:"):
            warns.append("note: " + n["text"])
    return errs, warns


def main():
    ids = sys.argv[1:]
    paths = [os.path.join(ROOT, "recipes", i + ".json") for i in ids] if ids else sorted(glob.glob(os.path.join(ROOT, "recipes", "*.json")))
    bad = 0
    for p in paths:
        errs, warns = check(p)
        name = os.path.basename(p)
        print(("FAIL " if errs else "ok   ") + name)
        for e in errs:
            print("  ERROR " + e)
        for w in warns:
            print("  WARN  " + w)
        bad += bool(errs)
    print("\n%d recipe(s), %d failed" % (len(paths), bad))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
