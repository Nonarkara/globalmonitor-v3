#!/usr/bin/env python3
"""Sample ADS-B state vectors from the OpenSky Network anonymous REST API (research use).
Regions: Middle East + two control regions. Usage: collect_opensky.py OUTDIR N_SAMPLES INTERVAL_SECONDS
"""
import json, sys, time, urllib.request, urllib.error, datetime as dt, os
OUT, N, GAP = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
BBOX = {"middleeast": (10, 24, 42, 65), "europe": (35, -10, 60, 30), "seasia": (-10, 90, 25, 135)}   # lamin, lomin, lamax, lomax
COLS = ["icao24", "callsign", "origin_country", "time_position", "last_contact", "lon", "lat", "baro_alt", "on_ground", "velocity", "true_track", "vrate", "sensors", "geo_alt", "squawk", "spi", "position_source"]
def fetch(b, tries=6):
    url = "https://opensky-network.org/api/states/all?lamin=%s&lomin=%s&lamax=%s&lomax=%s" % b
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "globalwatch-research/1.0 (non.ar@depa.or.th)"}), timeout=60) as f:
                return json.load(f)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or k == tries - 1: raise
            time.sleep(int(e.headers.get("X-Rate-Limit-Retry-After-Seconds", 30)) + 3)
for i in range(N):
    t0 = dt.datetime.now(dt.timezone.utc); s = {"collectedAt": t0.isoformat(), "cols": COLS, "regions": {}}
    for name, b in BBOX.items():
        try:
            d = fetch(b); s["regions"][name] = {"time": d.get("time"), "states": d.get("states") or []}
        except Exception as e:
            print("ERR", name, e, file=sys.stderr); s["regions"][name] = {"time": None, "states": []}
        time.sleep(12)
    fn = os.path.join(OUT, t0.strftime("opensky_%Y%m%dT%H%M%SZ.json")); json.dump(s, open(fn, "w"))
    print(fn, {k: len(v["states"]) for k, v in s["regions"].items()}, flush=True)
    if i < N - 1: time.sleep(max(0, GAP - (dt.datetime.now(dt.timezone.utc) - t0).total_seconds()))
