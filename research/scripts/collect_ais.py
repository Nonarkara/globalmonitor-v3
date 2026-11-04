#!/usr/bin/env python3
"""Fetch the global AIS snapshot from Axiom Overwatch (CC-BY 4.0, https://axiomoverwatch.io).
Usage: collect_ais.py OUTDIR N_SAMPLES INTERVAL_SECONDS
"""
import json, sys, time, urllib.request, datetime as dt, os
OUT, N, GAP = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
URL = "https://www.axiomoverwatch.io/api/v1/positions/latest?west=-180&south=-90&east=180&north=90"
for i in range(N):
    t0 = dt.datetime.now(dt.timezone.utc)
    req = urllib.request.Request(URL, headers={"Accept": "application/json", "User-Agent": "globalwatch-research/1.0 (non.ar@depa.or.th)"})
    with urllib.request.urlopen(req, timeout=120) as f:
        d = json.load(f)
    fn = os.path.join(OUT, t0.strftime("ais_%Y%m%dT%H%M%SZ.json"))
    json.dump(d, open(fn, "w"))
    print(fn, len(d.get("features", [])), {k: v for k, v in d.items() if k != "features"}, flush=True)
    if i < N - 1: time.sleep(max(0, GAP - (dt.datetime.now(dt.timezone.utc) - t0).total_seconds()))
