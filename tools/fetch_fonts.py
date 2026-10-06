# Downloads the subset fonts the textures use from Google Fonts (OFL licensed)
# and writes them as base64 into hooks/fonts.js, so the mod never fetches. Run: python tools/fetch_fonts.py
import base64, os, re, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

# Every character the band can draw: letters, digits, Portuguese accents, punctuation
CHARS = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    "ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç"
    " %:/·,.-–—…+()!?'"
)

# key -> (Google family, weight, family name inside the SVG)
FONTS = {
    "press400": ("Press Start 2P", 400, "UMPress"),
    "cinzel700": ("Cinzel", 700, "UMCinzel"),
    "barlow500": ("Barlow Condensed", 500, "UMBarlow"),
    "barlow600": ("Barlow Condensed", 600, "UMBarlow"),
    "nunito700": ("Nunito", 700, "UMNunito"),
    "nunito800": ("Nunito", 800, "UMNunito"),
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


out = ["// Subset fonts for the textures, from Google Fonts (SIL Open Font License).",
       "// Written by fetch_fonts.py; each entry is a woff2 file as base64.",
       "export const FONTS = {"]
total = 0
for key, (family, weight, name) in FONTS.items():
    q = urllib.parse.urlencode({"family": f"{family}:wght@{weight}", "text": CHARS, "display": "block"})
    css = get("https://fonts.googleapis.com/css2?" + q).decode()
    urls = re.findall(r"url\((https://[^)]+)\)", css)
    assert len(urls) == 1, (key, css[:300])
    data = get(urls[0])
    b64 = base64.b64encode(data).decode()
    total += len(b64)
    print(f"{key:12} {family} {weight}: {len(data):6} bytes")
    out.append(f"  {key}: {{ family: '{name}', weight: {weight}, data: '{b64}' }},")
out.append("}")
open(os.path.join(HERE, "..", "hooks", "fonts.js"), "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
print("total base64 chars:", total)

# The fonts are modified versions (subsets): give them the mod's own names inside too
import sys
sys.path.insert(0, HERE)
import rename_fonts
rename_fonts.main()
