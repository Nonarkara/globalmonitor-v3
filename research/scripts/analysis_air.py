#!/usr/bin/env python3
"""Airspace occupancy: ADS-B state vectors (OpenSky anonymous API) by country, with EASA CZIB status overlaid.
Density = airborne ADS-B aircraft per 100,000 km^2 of country area inside the sampled box, averaged over samples.
Absence of aircraft is NOT proof of closure: receiver coverage is uneven (see paper, Sec. Limitations)."""
import json, glob, os, math, collections
import numpy as np
from shapely.geometry import Point, box
from shapely.strtree import STRtree
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
import style, geo; style.apply()
HERE = os.path.dirname(os.path.abspath(__file__)); DER = os.path.join(HERE, "..", "derived"); FIG = os.path.join(HERE, "..", "figures")
RAW = os.environ.get("GW_RAW", "/Volumes/Data/agent-scratch/gm-research/raw")
BOXES = {"middleeast": (24, 10, 65, 42), "europe": (-10, 35, 30, 60), "seasia": (90, -10, 135, 25)}  # w,s,e,n
# EASA CZIBs active on 2026-11-04 (country-level subset of the page; see paper Table). Sea areas excluded from country density.
CZIB = {"Iran", "Iraq", "Lebanon", "Jordan", "Saudi Arabia", "Syria", "Yemen", "Libya", "Sudan", "Afghanistan", "Pakistan", "Ukraine", "Russia"}
polys, names, iso = geo.countries(); tree = STRtree(polys)
def km2(g):  # equal-area-ish: deg^2 * (111.32 km)^2 * cos(lat)
    return g.area * 111.32 ** 2 * math.cos(math.radians(g.centroid.y))
def clipped_area(region):
    w, s, e, n = BOXES[region]; b = box(w, s, e, n); out = {}
    for i in tree.query(b):
        g = polys[i].intersection(b)
        if not g.is_empty: out[names[i]] = out.get(names[i], 0) + km2(g)
    return out
def assign(lon, lat):
    p = Point(lon, lat); idx = tree.query(p, predicate="intersects"); return names[idx[0]] if len(idx) else None
files = sorted(glob.glob(os.path.join(RAW, "opensky", "opensky_*.json"))); samples = [json.load(open(f)) for f in files]
res = {"n_samples": len(samples), "collected": [s["collectedAt"] for s in samples], "regions": {}}
for region in BOXES:
    area = clipped_area(region); per = collections.defaultdict(list); tot = []; alt_cruise = []
    for s in samples:
        c = collections.Counter(); cr = collections.Counter(); n = 0
        for st in s["regions"][region]["states"]:
            lon, lat, og, alt, src = st[5], st[6], st[8], st[7], st[16]
            if lon is None or lat is None or og: continue
            n += 1; ctry = assign(lon, lat) or "(sea)"; c[ctry] += 1
            if alt is not None and alt >= 7000: cr[ctry] += 1
        tot.append(n)
        for k in set(area) | set(c): per[k].append((c.get(k, 0), cr.get(k, 0)))
    rows = []
    for k, v in per.items():
        if k == "(sea)" or k not in area or area[k] < 2e4: continue
        m = np.mean([x[0] for x in v]); cr = np.mean([x[1] for x in v]); rows.append({"country": k, "area_km2": round(area[k]), "mean_aircraft": round(float(m), 1), "mean_cruise": round(float(cr), 1), "per_1e5km2": round(float(1e5 * m / area[k]), 2), "czib": k in CZIB})
    rows.sort(key=lambda r: -r["per_1e5km2"]); res["regions"][region] = {"airborne_mean": round(float(np.mean(tot)), 1), "airborne_range": [int(min(tot)), int(max(tot))], "countries": rows}
json.dump(res, open(os.path.join(DER, "air_density.json"), "w"), indent=1)
me = res["regions"]["middleeast"]["countries"]
print("samples:", res["n_samples"], {r: (v["airborne_mean"], v["airborne_range"]) for r, v in res["regions"].items()})
for r in me: print(f"{r['country']:22s} area={r['area_km2']:>9,} mean={r['mean_aircraft']:6.1f} cruise={r['mean_cruise']:6.1f} dens={r['per_1e5km2']:6.2f} CZIB={r['czib']}")
for reg in ("europe", "seasia"):
    d = [r["per_1e5km2"] for r in res["regions"][reg]["countries"]]; print(reg, "median density", np.median(d), "n countries", len(d))
