"""Trace the NODIFS logo into coloured vector pieces for the 3D crest (js/logo3d.js).
Usage (needs numpy, scipy, pillow, potracer):
  python3 tools/trace-logo.py images/nodifs-logo.png data/logo3d.json preview.svg
Pieces: {c: colour, g: group, d: SVG path, outer edge first then holes}, in 2x-upscaled pixels with y down."""
import sys, json
import numpy as np
import potrace
from PIL import Image
from scipy import ndimage as ndi

SRC, OUT, SVG = sys.argv[1:4]
S = 2
CREST_BOTTOM = 1740          # 2x px: crest above, wordmark below
CROP_BOTTOM = 2420           # drop the black JPEG padding rows at the bottom
PALETTE = {"white": (251, 251, 252), "navy": (13, 28, 80), "blue": (102, 164, 239), "red": (197, 44, 40)}
NAMES = list(PALETTE)

im = Image.open(SRC).convert("RGB")
big = np.asarray(im.resize((im.width * S, im.height * S), Image.LANCZOS)).astype(float)[:CROP_BOTTOM]
P = np.array(list(PALETTE.values()), float)
lab = ((big[:, :, None, :] - P[None, None]) ** 2).sum(-1).argmin(-1)
lab[big.max(-1) < 40] = NAMES.index("navy")
H, W = lab.shape

white = lab == 0
L, _ = ndi.label(white)
border = set(np.unique(np.r_[L[0], L[-1], L[:, 0], L[:, -1]])) - {0}
inner_white = white & ~np.isin(L, list(border))
inner_white[CREST_BOTTOM:] = False            # letter counters are holes, not pieces

masks = {"navy": lab == 1, "blue": lab == 2, "red": lab == 3, "white": inner_white}
for k, m in masks.items():
    masks[k] = ndi.binary_closing(ndi.binary_opening(m, iterations=1), iterations=1)

# shield frame = biggest navy piece in the crest; its filled silhouette becomes the back plate
nl, _ = ndi.label(masks["navy"][:CREST_BOTTOM])
frame_id = np.bincount(nl.ravel())[1:].argmax() + 1
plate = ndi.binary_fill_holes(nl == frame_id)
ys, xs = np.nonzero(plate)
SH = dict(x0=xs.min(), x1=xs.max(), y0=ys.min(), y1=ys.max())
print("shield bbox", SH)


def fmt(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def path_d(curve):
    sp = curve.start_point
    d = [f"M{fmt(sp.x)} {fmt(sp.y)}"]
    for s in curve:
        if s.is_corner:
            d.append(f"L{fmt(s.c.x)} {fmt(s.c.y)}L{fmt(s.end_point.x)} {fmt(s.end_point.y)}")
        else:
            d.append(f"C{fmt(s.c1.x)} {fmt(s.c1.y)} {fmt(s.c2.x)} {fmt(s.c2.y)} {fmt(s.end_point.x)} {fmt(s.end_point.y)}")
    return "".join(d) + "Z"


def poly_area(curve):
    pts = [(curve.start_point.x, curve.start_point.y)] + [(s.end_point.x, s.end_point.y) for s in curve]
    return abs(sum(pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1] for i in range(len(pts) - 1)) / 2)


def trace(mask):
    """Trace one connected piece; returns the path with its outer edge first, holes after."""
    ys, xs = np.nonzero(mask)
    pad = 3
    y0, y1, x0, x1 = max(ys.min() - pad, 0), ys.max() + pad + 1, max(xs.min() - pad, 0), xs.max() + pad + 1
    sub = mask[y0:y1, x0:x1]
    curves = potrace.Bitmap(~sub).trace(turdsize=12, alphamax=1.0, opticurve=True, opttolerance=0.25)
    curves = [c for c in curves if poly_area(c) > 20]
    # the frame around the whole crop is traced too (potracer quirk); drop curves touching the crop edge
    h, w = sub.shape
    def touches_edge(c):
        p = [c.start_point] + [s.end_point for s in c]
        return any(q.x <= 0.01 or q.y <= 0.01 or q.x >= w - 0.01 or q.y >= h - 0.01 for q in p)
    curves = [c for c in curves if not touches_edge(c)]
    curves.sort(key=poly_area, reverse=True)
    if not curves:
        return None
    return x0, y0, [path_d(c) for c in curves]


def shifted(d, dx, dy):
    import re
    toks = re.findall(r"[MLCZ]|-?\d+(?:\.\d+)?", d)
    res, i, cmd = [], 0, None
    for t in toks:
        if t in "MLCZ":
            cmd = t; res.append(t); i = 0
        else:
            v = float(t) + (dx if i % 2 == 0 else dy)
            res.append(fmt(v) if res[-1] in "MLC" else " " + fmt(v))
            i += 1
    return "".join(res)


GLOBE = None
wm = masks["white"].copy()
wl, _ = ndi.label(wm)
# globe ocean = the roundest large inner-white piece
best = None
for i, sl in enumerate(ndi.find_objects(wl), 1):
    h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    if h > 300 and abs(h - w) < 0.08 * h:
        if best is None or h > best[2]:
            best = ((sl[1].start + sl[1].stop) / 2, (sl[0].start + sl[0].stop) / 2, h)
GLOBE = dict(cx=best[0], cy=best[1], r=best[2] / 2)
print("globe", GLOBE)


def group_of(colour, cx, cy, x0, y0, x1, y1, size, biggest):
    if cy >= CREST_BOTTOM:
        return "word"
    if biggest:
        return "shield"
    if y1 < SH["y0"] + 60 or (cy < SH["y0"] + 40):
        return "cap"
    gx, gy, gr = GLOBE["cx"], GLOBE["cy"], GLOBE["r"]
    if (cx - gx) ** 2 + (cy - gy) ** 2 < (gr * 1.08) ** 2 and x0 >= gx - gr * 1.15 and x1 <= gx + gr * 1.15:
        return "globe"
    if y1 < gy - gr and SH["x0"] < cx < SH["x1"]:
        return "star"
    if cy > SH["y1"] - 260 and (x0 < SH["x0"] - 20 or x1 > SH["x1"] + 20):
        return "ribbon"
    if cx < SH["x0"]:
        return "laurelL"
    if cx > SH["x1"]:
        return "laurelR"
    if cy > gy + gr * 0.7:
        return "book"
    return "shield"


pieces = []
for colour in ["navy", "blue", "red", "white"]:
    m = masks[colour]
    lbl, n = ndi.label(m)
    sizes = np.bincount(lbl.ravel())
    crest_sizes = np.bincount(lbl[:CREST_BOTTOM].ravel(), minlength=n + 1)
    big_id = crest_sizes[1:].argmax() + 1
    for i, sl in enumerate(ndi.find_objects(lbl), 1):
        if sizes[i] < 60:
            continue
        piece = lbl[sl] == i
        full = np.zeros_like(m)
        full[sl] = piece
        r = trace(full)
        if not r:
            continue
        x0, y0, ds = r
        bx0, by0, bx1, by1 = sl[1].start, sl[0].start, sl[1].stop, sl[0].stop
        cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
        g = group_of(colour, cx, cy, bx0, by0, bx1, by1, sizes[i], i == big_id)
        pieces.append(dict(c=colour, g=g, x=int(cx), y=int(cy), a=int(sizes[i]),
                           d="".join(shifted(d, x0, y0) for d in ds)))

# back plate (shield silhouette)
r = trace(plate)
pieces.insert(0, dict(c="navy", g="plate", x=int((SH["x0"] + SH["x1"]) / 2), y=int((SH["y0"] + SH["y1"]) / 2),
                      a=int(plate.sum()), d="".join(shifted(d, r[0], r[1]) for d in r[2][:1])))

from collections import Counter
print(Counter((p["g"], p["c"]) for p in pieces))
data = dict(w=W, h=H, crestBottom=CREST_BOTTOM, shield=SH | {}, globe=GLOBE, pieces=pieces)
data["shield"] = {k: int(v) for k, v in SH.items()}
data["globe"] = {k: round(v, 1) for k, v in GLOBE.items()}
json.dump(data, open(OUT, "w"), separators=(",", ":"))
print("json bytes", len(json.dumps(data, separators=(",", ":"))), "pieces", len(pieces))

HEX = {"navy": "#0d1c50", "blue": "#66a4ef", "red": "#c52c28", "white": "#ffffff"}
GCOL = {"cap": "#f0a", "globe": "#0a0", "star": "#fa0", "book": "#0af", "laurelL": "#a50", "laurelR": "#a05",
        "ribbon": "#05a", "shield": "#888", "word": "#000", "plate": "#ccc"}
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W * 2} {H}" width="{W}" height="{H // 2}">',
       f'<rect width="{W * 2}" height="{H}" fill="#eef1f6"/>']
for p in pieces:
    if p["g"] == "plate":
        continue
    svg.append(f'<path fill-rule="evenodd" fill="{HEX[p["c"]]}" d="{p["d"]}"/>')
svg.append(f'<g transform="translate({W} 0)">')
for p in pieces:
    svg.append(f'<path fill-rule="evenodd" fill="{GCOL[p["g"]]}" fill-opacity="{0.35 if p["g"] in ("plate","shield") else 0.85}" stroke="#000" stroke-width="2" d="{p["d"]}"/>')
svg.append("</g></svg>")
open(SVG, "w").write("\n".join(svg))
