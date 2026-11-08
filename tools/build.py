"""Build the app's encrypted data from recipes/*.json and images/, apply the
ingredient alias map, and bump the service worker cache version.

Usage: python tools/build.py

The passphrase comes from the RX_PASSPHRASE environment variable, or else from
the file .passphrase in the repo root (gitignored, never committed).

Outputs (these are what get published):
  vault/meta.json        salt and KDF settings (not secret)
  vault/recipes.bin      all recipe data, encrypted
  vault/i/<hash>.bin     each hero image, encrypted; names don't reveal titles
Also writes data/recipes.json (plaintext, gitignored) for local checks.

Format of each .bin: 12-byte IV followed by AES-256-GCM ciphertext+tag.
Key: PBKDF2-HMAC-SHA256(passphrase, salt, ITER) -> 32 bytes.
Image IVs are derived from the content (HMAC), so unchanged images produce
identical files and git doesn't churn.
"""
import json, os, glob, re, time, hashlib, hmac, base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VAULT = os.path.join(ROOT, "vault")
ITER = 310000


def passphrase():
    p = os.environ.get("RX_PASSPHRASE")
    if not p:
        f = os.path.join(ROOT, ".passphrase")
        if os.path.exists(f):
            p = open(f, encoding="utf-8").read().strip()
    if not p:
        raise SystemExit("No passphrase. Put it in .passphrase in the repo root (one line).")
    if len(p) < 8:
        raise SystemExit("Passphrase is too short. Use at least 3 or 4 words.")
    return p


def derive(p, salt):
    return hashlib.pbkdf2_hmac("sha256", p.encode("utf-8"), salt, ITER, 32)


def seal(key, data):
    iv = hmac.new(key, data, hashlib.sha256).digest()[:12]
    return iv + AESGCM(key).encrypt(iv, data, None)


def opens(key, blob):
    try:
        AESGCM(key).decrypt(blob[:12], blob[12:], None)
        return True
    except (InvalidTag, ValueError):
        return False


def get_key(p):
    """Reuse the existing salt if the passphrase still matches, so files stay stable."""
    meta_p = os.path.join(VAULT, "meta.json")
    data_p = os.path.join(VAULT, "recipes.bin")
    if os.path.exists(meta_p) and os.path.exists(data_p):
        meta = json.load(open(meta_p))
        if meta.get("iter") == ITER:
            salt = base64.b64decode(meta["salt"])
            key = derive(p, salt)
            if opens(key, open(data_p, "rb").read()):
                return key, meta, False
    salt = os.urandom(16)
    meta = {"v": 1, "kdf": "PBKDF2-SHA256", "iter": ITER, "salt": base64.b64encode(salt).decode()}
    return derive(p, salt), meta, True


def img_name(rid):
    return "vault/i/" + hashlib.sha256(("img:" + rid).encode()).hexdigest()[:20] + ".bin"


def write_if_changed(path, data):
    if os.path.exists(path) and open(path, "rb").read() == data:
        return
    open(path, "wb").write(data)


def main():
    p = passphrase()
    aliases = json.load(open(os.path.join(ROOT, "tools", "ingredients.json"), encoding="utf-8")).get("aliases", {})
    recipes = []
    for path in sorted(glob.glob(os.path.join(ROOT, "recipes", "*.json"))):
        r = json.load(open(path, encoding="utf-8"))
        for ing in r["ingredients"]:
            ing["name"] = aliases.get(ing["name"], ing["name"])
        recipes.append(r)
    recipes.sort(key=lambda r: r["title"].lower())

    # Plaintext copy for local checks only (gitignored).
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    with open(os.path.join(ROOT, "data", "recipes.json"), "w", encoding="utf-8") as f:
        json.dump({"built": int(time.time()), "recipes": recipes}, f, ensure_ascii=False, separators=(",", ":"))

    key, meta, fresh = get_key(p)
    os.makedirs(os.path.join(VAULT, "i"), exist_ok=True)
    if fresh:
        for old in glob.glob(os.path.join(VAULT, "i", "*.bin")):
            os.remove(old)

    # Encrypt images; point each recipe at its encrypted file.
    images, keep = [], set()
    for r in recipes:
        src = os.path.join(ROOT, r["image"])
        if not os.path.exists(src):
            raise SystemExit("Missing image for %s: %s" % (r["id"], r["image"]))
        out = img_name(r["id"])
        write_if_changed(os.path.join(ROOT, out), seal(key, open(src, "rb").read()))
        r["image"] = out
        images.append(out)
        keep.add(os.path.normcase(os.path.join(ROOT, out)))
    for old in glob.glob(os.path.join(VAULT, "i", "*.bin")):
        if os.path.normcase(old) not in keep:
            os.remove(old)

    payload = json.dumps({"built": int(time.time()), "recipes": recipes}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    open(os.path.join(VAULT, "recipes.bin"), "wb").write(seal(key, payload))
    json.dump(meta, open(os.path.join(VAULT, "meta.json"), "w"), indent=1)

    # Bump service worker cache version and refresh the image list.
    sw = os.path.join(ROOT, "sw.js")
    src = open(sw, encoding="utf-8").read()
    version = time.strftime("v%Y%m%d-%H%M%S")
    src = re.sub(r"const VERSION = '[^']*';", "const VERSION = '%s';" % version, src)
    src = re.sub(r"const IMAGES = \[[^\]]*\];", "const IMAGES = %s;" % json.dumps(images), src)
    open(sw, "w", encoding="utf-8", newline="\n").write(src)
    print("Built %d recipes, cache %s%s" % (len(recipes), version, " (new key)" if fresh else ""))


if __name__ == "__main__":
    main()
