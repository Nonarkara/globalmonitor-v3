#!/usr/bin/env python3
"""Figure: airborne ADS-B aircraft over the Middle East box (all samples pooled, lighter = lower altitude) with EASA CZIB countries shaded."""
import json, glob, os
import numpy as np
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.patches import PathPatch
from matplotlib.path import Path
import style, geo; style.apply()
HERE = os.path.dirname(os.path.abspath(__file__)); DER = os.path.join(HERE, "..", "derived"); FIG = os.path.join(HERE, "..", "figures")
RAW = os.environ.get("GW_RAW", "/Volumes/Data/agent-scratch/gm-research/raw")
CZIB = {"Iran", "Iraq", "Lebanon", "Jordan", "Saudi Arabia", "Syria", "Yemen", "Libya", "Sudan", "Afghanistan", "Pakistan"}
res = json.load(open(os.path.join(DER, "air_density.json"))); samples = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(RAW, "opensky", "opensky_*.json")))]
pts = []
for s in samples:
    for st in s["regions"]["middleeast"]["states"]:
        if st[5] is None or st[6] is None or st[8]: continue
        pts.append((st[5], st[6], st[7] if st[7] is not None else np.nan))
P = np.array(pts); n = len(samples)
fig = plt.figure(figsize=(7.1, 3.35)); gs = fig.add_gridspec(1, 2, width_ratios=[1.55, 1], wspace=0.30)
ax = fig.add_subplot(gs[0]); polys, names, iso = geo.countries()
def draw(p, fc, ec="#bdb9ad", lw=0.35):
    geoms = p.geoms if p.geom_type == "MultiPolygon" else [p]
    for g in geoms:
        xs, ys = g.exterior.xy; ax.fill(xs, ys, fc=fc, ec=ec, lw=lw, zorder=0)
for p, nm in zip(polys, names): draw(p, "#f0d9d3" if nm in CZIB else "#f4f2ec")
hi = P[:, 2] >= 7000
ax.scatter(P[~hi, 0], P[~hi, 1], s=2.2, c=style.INK3, lw=0, alpha=0.8, zorder=2, label="below 7 km")
ax.scatter(P[hi, 0], P[hi, 1], s=2.2, c=style.INK, lw=0, alpha=0.8, zorder=3, label="7 km and above")
ax.set_xlim(24, 65); ax.set_ylim(10, 42); ax.set_aspect(1 / np.cos(np.radians(27))); ax.set_xticks([]); ax.set_yticks([]); ax.grid(False)
for sp in ax.spines.values(): sp.set_visible(False)
ax.set_title(f"A  {len(P)/n:,.0f} airborne aircraft per sample (n = {n}); shaded: EASA bulletin", loc="left", fontweight="bold", fontsize=7.4)
bx = fig.add_subplot(gs[1]); rows = [r for r in res["regions"]["middleeast"]["countries"] if r["area_km2"] >= 2e4 and (r["mean_aircraft"] > 0 or r["czib"] or r["country"] in ("Egypt", "Turkey", "Oman"))]
rows = sorted(rows, key=lambda r: r["per_1e5km2"]); yy = np.arange(len(rows))
bx.barh(yy, [r["per_1e5km2"] for r in rows], color=[style.RED if r["czib"] else style.INK2 for r in rows], height=0.66)
bx.set_yticks(yy); bx.set_yticklabels([r["country"] for r in rows], fontsize=6.2); bx.set_xlabel("aircraft per 100,000 km²"); bx.grid(axis="y", visible=False)
bx.legend(*ax.get_legend_handles_labels(), loc="lower right", markerscale=3, fontsize=6.3, handletextpad=0.2, title="Map dots", title_fontsize=6.3, alignment="left")
bx.set_title("B  Occupancy by country", loc="left", fontweight="bold")
fig.savefig(os.path.join(FIG, "fig_air.pdf"))
