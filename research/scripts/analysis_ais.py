#!/usr/bin/env python3
"""Maritime cross-section: vessels at world chokepoints from the global AIS snapshot(s).
Only positions reported within FRESH_H hours of the snapshot are treated as 'currently at sea'.
"""
import json, glob, os, sys, datetime as dt, collections
import numpy as np
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
import style, geo; style.apply()
HERE = os.path.dirname(os.path.abspath(__file__)); DER = os.path.join(HERE, "..", "derived"); FIG = os.path.join(HERE, "..", "figures")
RAW = os.environ.get("GW_RAW", "/Volumes/Data/agent-scratch/gm-research/raw"); FRESH_H = 6
BOX = {  # name: (west, south, east, north) — hand-drawn analysis boxes, documented in the paper
 "Persian Gulf": (48, 24, 54.5, 30), "Hormuz": (54.5, 25.4, 57.5, 27.3), "Gulf of Oman": (57.5, 22, 62, 26),
 "Bab el-Mandeb": (42, 11.5, 45, 13.8), "Red Sea": (32.5, 14, 43, 28), "Suez": (31.8, 29, 33, 31.8),
 "Cape (S. Africa)": (16, -37, 22, -33), "Malacca": (98, 0.8, 104.5, 6), "Singapore": (103.4, 1.0, 104.5, 1.6),
 "Taiwan Strait": (118, 22, 121.5, 26), "North Sea": (-2, 51, 8, 58), "Baltic": (10, 54, 26, 60), "Eastern Med": (26, 31, 36, 37), "Bosporus/Marmara": (26.5, 40.3, 29.8, 41.4), "English Channel": (-2.5, 49.5, 2, 51.3), "Panama": (-80.2, 8.8, -79.4, 9.6),
}
TANK = {"tanker", "chemical_tanker", "lng_carrier"}; CARGO = {"bulk_carrier", "general_cargo", "container", "cargo"}
def parse(ts): return dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
def load(fn):
    d = json.load(open(fn)); snap = parse(d["meta"]["updated_at"]); rows = []
    for f in d["features"]:
        p = f["properties"]; lon, lat = f["geometry"]["coordinates"]; ts = p.get("last_seen") or p.get("timestamp")
        age = (snap - parse(ts)).total_seconds() / 3600 if ts else np.nan
        rows.append((lon, lat, p.get("vessel_type") or "other", p.get("speed") if p.get("speed") is not None else np.nan, age))
    a = np.array([(r[0], r[1], r[3], r[4]) for r in rows], float); t = [r[2] for r in rows]
    return snap, a, t
res = []
for fn in sorted(glob.glob(os.path.join(RAW, "ais", "ais_*.json"))):
    snap, a, t = load(fn); n = len(a); fresh = a[:, 3] <= FRESH_H
    ages = a[:, 3][~np.isnan(a[:, 3])]
    r = {"snapshot": snap.isoformat(), "n_total": n, "n_fresh_6h": int(fresh.sum()), "share_fresh_6h": round(float(fresh.mean()), 3),
         "age_h_quantiles_10_50_90": [round(float(np.quantile(ages, q)), 1) for q in (.1, .5, .9)], "boxes": {}}
    tt = np.array(t)
    for name, (w, s, e, nn) in BOX.items():
        m = fresh & (a[:, 0] >= w) & (a[:, 0] <= e) & (a[:, 1] >= s) & (a[:, 1] <= nn)
        sp = a[m, 2]; mv = sp[sp > 0.5]
        ag = a[m & ~np.isnan(a[:, 3]), 3]; allm = (a[:, 0] >= w) & (a[:, 0] <= e) & (a[:, 1] >= s) & (a[:, 1] <= nn)
        r["boxes"][name] = {"n_all_ages": int(allm.sum()), "median_age_h": round(float(np.median(a[allm, 3])), 0) if allm.sum() else None, "n": int(m.sum()), "tanker": int(np.isin(tt[m], list(TANK)).sum()), "cargo": int(np.isin(tt[m], list(CARGO)).sum()),
                            "military": int((tt[m] == "military").sum()), "share_moving": round(float((sp > 0.5).mean()), 2) if m.sum() else None,
                            "median_speed_moving_kn": round(float(np.median(mv)), 1) if len(mv) else None}
    res.append(r)
json.dump(res, open(os.path.join(DER, "ais_chokepoints.json"), "w"), indent=1)
for r in res:
    print(r["snapshot"], r["n_total"], r["n_fresh_6h"], r["share_fresh_6h"], r["age_h_quantiles_10_50_90"])
    for k, v in r["boxes"].items(): print(f"  {k:18s} n={v['n']:5d} tank={v['tanker']:4d} cargo={v['cargo']:4d} mil={v['military']} moving={v['share_moving']} v={v['median_speed_moving_kn']}")
# Figure: freshness map + per-box age mix (first snapshot)
fn0 = sorted(glob.glob(os.path.join(RAW, "ais", "ais_*.json")))[0]; snap, a, t = load(fn0); age = a[:, 3]
fig = plt.figure(figsize=(7.1, 3.05)); gs = fig.add_gridspec(1, 2, width_ratios=[1.45, 1], wspace=0.60)
lg = gs[0].subgridspec(2, 1, height_ratios=[1.0, 1.05], hspace=0.22)
stale = age > 168; mid = (age > FRESH_H) & ~stale; fresh = age <= FRESH_H
def paint(ax, k):
    geo.draw_land(ax)
    ax.scatter(a[stale, 0], a[stale, 1], s=0.10 * k, c=style.INK3, alpha=0.30, lw=0, rasterized=True, zorder=2)
    ax.scatter(a[mid, 0], a[mid, 1], s=0.12 * k, c=style.INK2, alpha=0.40, lw=0, rasterized=True, zorder=2)
    ax.scatter(a[fresh, 0], a[fresh, 1], s=0.22 * k, c=style.RED, alpha=0.55, lw=0, rasterized=True, zorder=3)
    ax.set_aspect("equal"); ax.set_xticks([]); ax.set_yticks([]); ax.grid(False); ax.set_anchor("NW")
    for sp in ax.spines.values(): sp.set_visible(False)
ax = fig.add_subplot(lg[0]); paint(ax, 1); ax.set_xlim(-170, 180); ax.set_ylim(-58, 78)
for name in ("Hormuz", "Persian Gulf", "Gulf of Oman", "Bab el-Mandeb", "Red Sea"):
    w, s_, e, n_ = BOX[name]; ax.add_patch(plt.Rectangle((w, s_), e - w, n_ - s_, fill=False, ec=style.INK, lw=0.6, zorder=4))
ax.set_title("A  The world: last position of every vessel", loc="left", fontweight="bold", fontsize=7.4)
zg = lg[1].subgridspec(1, 2, width_ratios=[1.0, 1.0], wspace=0.08)
zx = fig.add_subplot(zg[0]); paint(zx, 6); zx.set_xlim(31, 63); zx.set_ylim(10, 32)
for name in ("Hormuz", "Persian Gulf", "Gulf of Oman", "Bab el-Mandeb", "Red Sea"):
    w, s_, e, n_ = BOX[name]; zx.add_patch(plt.Rectangle((w, s_), e - w, n_ - s_, fill=False, ec=style.INK, lw=0.6, zorder=4))
for txt, x, y, ha in (("Red Sea", 33.2, 26.9, "left"), ("Persian Gulf", 51.2, 31.0, "center"), ("Hormuz", 57.2, 23.4, "right")):
    zx.text(x, y, txt, fontsize=5.2, ha=ha, va="center", color=style.INK, zorder=5)
zx.set_title("A′  Zoom: the Red Sea and the Gulf", loc="left", fontweight="bold", fontsize=6.6)
kx = fig.add_subplot(zg[1]); kx.axis("off")
from matplotlib.patches import Patch
kx.legend(handles=[Patch(color=c, label=l) for c, l in zip([style.RED, style.INK2, style.INK3, "#e0ddd3"], ["≤ 6 h: heard now", "6 h – 7 d", "7 – 30 d", "> 30 d"])], loc="upper left", fontsize=5.8, handlelength=0.9, labelspacing=0.5, title="Age of last position", title_fontsize=6.0, alignment="left", borderaxespad=0.2)
bx = fig.add_subplot(gs[1]); names = ["North Sea", "Baltic", "English Channel", "Eastern Med", "Suez", "Malacca", "Taiwan Strait", "Persian Gulf", "Hormuz", "Gulf of Oman", "Red Sea", "Bab el-Mandeb"]
yy = np.arange(len(names))[::-1]; left = np.zeros(len(names))
allv = a; 
def mix(name):
    w, s_, e, n_ = BOX[name]; m = (a[:, 0] >= w) & (a[:, 0] <= e) & (a[:, 1] >= s_) & (a[:, 1] <= n_) & ~np.isnan(age); g = age[m]
    if len(g) == 0: return np.array([np.nan] * 4), 0
    return np.array([(g <= FRESH_H).mean(), ((g > FRESH_H) & (g <= 168)).mean(), ((g > 168) & (g <= 720)).mean(), (g > 720).mean()]) * 100, len(g)
cols = [style.RED, style.INK2, style.INK3, "#e0ddd3"]; labs = ["≤ 6 h", "6 h – 7 d", "7 – 30 d", "> 30 d"]
for k in range(4):
    vals = []
    for nme in names: mm, _ = mix(nme); vals.append(0 if np.isnan(mm[k]) else mm[k])
    bx.barh(yy, vals, left=left, color=cols[k], height=0.66, label=labs[k], lw=0); left += np.array(vals)
for yv, nme in zip(yy, names):
    mm, cnt = mix(nme)
    if cnt == 0: bx.text(2, yv, "no vessel at any age", fontsize=5.8, va="center", color=style.INK2, style="italic")
bx.set_yticks(yy); bx.set_yticklabels([f"{n} ({mix(n)[1]:,})" for n in names], fontsize=6.0); bx.set_xlim(0, 100); bx.set_xlabel("% of last-reported positions, by age"); bx.grid(axis="y", visible=False)
bx.set_title("B  Age of the last position", loc="left", fontweight="bold", fontsize=7.4)
fig.savefig(os.path.join(FIG, "fig_ais.pdf"), dpi=300)
