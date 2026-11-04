#!/usr/bin/env python3
"""Thermal anomalies: persistence classification of 7 days of VIIRS 375 m detections (NASA FIRMS open CSV).
chronic = detected on >= two-thirds of the days present in the file (4 of 6 here) in the same ~1 km cell (industrial flares, kilns, persistent burns)
transient = detected on exactly 1 day (fires, strikes, one-off burns). No ground truth is claimed.
"""
import csv, json, os, collections
import numpy as np
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
import style; style.apply()
HERE = os.path.dirname(os.path.abspath(__file__)); DER = os.path.join(HERE, "..", "derived"); FIG = os.path.join(HERE, "..", "figures")
SRC = os.environ.get("GW_DATA", "/Volumes/Data/agent-scratch/gm-research/data") + "/firms_SUOMI_VIIRS_C2_Global_7d.csv"
REG = {"Persian Gulf basin": (46, 24, 58, 31), "Levant": (34, 29, 40, 38), "Ukraine": (22, 44, 41, 53), "Sudan": (21, 8, 38, 23), "Myanmar": (92, 15, 101, 28), "W. Europe (control)": (-10, 36, 10, 50)}
cells = {k: collections.defaultdict(lambda: {"days": set(), "frp": 0.0, "n": 0}) for k in REG}; dates = set(); total = 0; kept = 0
with open(SRC) as f:
    for r in csv.DictReader(f):
        total += 1
        if r["confidence"] == "l": continue
        kept += 1; lat, lon = float(r["latitude"]), float(r["longitude"]); dates.add(r["acq_date"])
        for k, (w, s, e, n) in REG.items():
            if w <= lon <= e and s <= lat <= n:
                c = cells[k][(round(lat, 2), round(lon, 2))]; c["days"].add(r["acq_date"]); c["frp"] = max(c["frp"], float(r["frp"] or 0)); c["n"] += 1
res = {"file": os.path.basename(SRC), "dates": [min(dates), max(dates)], "n_days": len(dates), "rows_total": total, "rows_nominal_or_high": kept, "regions": {}}
for k, cs in cells.items():
    n = len(cs); d = np.array([len(c["days"]) for c in cs.values()]); thr = int(np.ceil(2 * len(dates) / 3)); frp = np.array([c["frp"] for c in cs.values()])
    res["regions"][k] = {"cells": n, "detections": int(sum(c["n"] for c in cs.values())), "chronic_share": round(float((d >= thr).mean()), 3) if n else None, "transient_share": round(float((d == 1).mean()), 3) if n else None,
                         "transient_frp_ge_50MW": int(((d == 1) & (frp >= 50)).sum()), "median_peak_frp_MW": round(float(np.median(frp)), 1) if n else None}
json.dump(res, open(os.path.join(DER, "firms_persistence.json"), "w"), indent=1); print(json.dumps(res, indent=1))
fig, ax = plt.subplots(figsize=(3.4, 2.1)); names = list(REG); yy = np.arange(len(names))[::-1]
ch = [100 * (res["regions"][k]["chronic_share"] or 0) for k in names]; tr = [100 * (res["regions"][k]["transient_share"] or 0) for k in names]; mid = [100 - a - b for a, b in zip(ch, tr)]
ax.barh(yy, ch, color=style.RED, height=0.62, label=f"chronic (≥{int(np.ceil(2*res['n_days']/3))} of {res['n_days']} days)"); ax.barh(yy, mid, left=ch, color=style.INK2, height=0.62, label="intermittent")
ax.barh(yy, tr, left=np.array(ch) + np.array(mid), color="#e0ddd3", height=0.62, label="transient (1 day)")
ax.set_yticks(yy); ax.set_yticklabels([f"{k}  (n={res['regions'][k]['cells']:,})" for k in names], fontsize=6.3); ax.set_xlabel("% of ~1 km cells with a detection"); ax.grid(axis="y", visible=False)
ax.legend(loc="upper center", bbox_to_anchor=(0.45, -0.28), ncol=3, fontsize=5.8, columnspacing=0.8, handlelength=1.0); fig.savefig(os.path.join(FIG, "fig_fire.pdf"))
