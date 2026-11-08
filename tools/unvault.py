"""Restore recipes/*.json and images/*.jpg from the encrypted vault/.
Use this to recover on a new computer after cloning the repo.

Usage: python tools/unvault.py   (passphrase from RX_PASSPHRASE or .passphrase)
Existing files are not overwritten."""
import json, os, base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

import build


def main():
    meta = json.load(open(os.path.join(build.VAULT, "meta.json")))
    key = build.derive(build.passphrase(), base64.b64decode(meta["salt"]))
    unseal = lambda b: AESGCM(key).decrypt(b[:12], b[12:], None)
    data = json.loads(unseal(open(os.path.join(build.VAULT, "recipes.bin"), "rb").read()))
    os.makedirs(os.path.join(build.ROOT, "recipes"), exist_ok=True)
    os.makedirs(os.path.join(build.ROOT, "images"), exist_ok=True)
    n = 0
    for r in data["recipes"]:
        img = "images/%s.jpg" % r["id"]
        ip = os.path.join(build.ROOT, img)
        if not os.path.exists(ip):
            open(ip, "wb").write(unseal(open(os.path.join(build.ROOT, r["image"]), "rb").read()))
        r["image"] = img
        rp = os.path.join(build.ROOT, "recipes", r["id"] + ".json")
        if not os.path.exists(rp):
            json.dump(r, open(rp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            n += 1
    print("Restored %d recipes" % n)


if __name__ == "__main__":
    main()
