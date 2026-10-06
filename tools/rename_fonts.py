# Renames the fonts embedded in hooks/fonts.js inside the files themselves: the SIL
# Open Font License keeps a Reserved Font Name (Press Start 2P has one) for the
# original, and these are modified versions (subset to the characters the band draws),
# so every name record becomes the mod's own family name (UMPress, UMCinzel, ...).
# fetch_fonts.py runs this after downloading; it can also run alone:
#   python tools/rename_fonts.py
import base64, io, os, re

from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS_JS = os.path.join(HERE, "..", "hooks", "fonts.js")

WEIGHT_NAMES = {400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold"}


def rename(data_b64, family, weight):
    font = TTFont(io.BytesIO(base64.b64decode(data_b64)))
    style = WEIGHT_NAMES.get(weight, str(weight))
    names = {
        1: family if style in ("Regular", "Bold") else f"{family} {style}",
        2: "Bold" if style == "Bold" else "Regular",
        3: f"{family}-{style};usage-mod",
        4: f"{family} {style}",
        6: f"{family}-{style}",
        16: family,
        17: style,
    }
    table = font["name"]
    for record in list(table.names):
        if record.nameID in names:
            table.setName(names[record.nameID], record.nameID, record.platformID, record.platEncID, record.langID)
    # Names the original carried that would still show it: unique ID variants, full
    # name in other places, and the WWS family. Drop the ones not rewritten above.
    for nid in (18, 21, 22, 25):
        table.removeNames(nameID=nid)
    out = io.BytesIO()
    font.flavor = "woff2"
    font.save(out)
    return base64.b64encode(out.getvalue()).decode("ascii")


def main():
    src = open(FONTS_JS, encoding="utf-8").read()
    pattern = re.compile(r"(\w+): \{ family: '(\w+)', weight: (\d+), data: '([A-Za-z0-9+/=]+)' \}")

    def sub(m):
        key, family, weight, data = m.group(1), m.group(2), int(m.group(3)), m.group(4)
        return f"{key}: {{ family: '{family}', weight: {weight}, data: '{rename(data, family, weight)}' }}"

    out, count = pattern.subn(sub, src)
    open(FONTS_JS, "w", encoding="utf-8", newline="\n").write(out)
    print(f"renamed {count} fonts in hooks/fonts.js")


if __name__ == "__main__":
    main()
