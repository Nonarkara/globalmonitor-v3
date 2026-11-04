#!/usr/bin/env python3
"""Daily port calls from IMF PortWatch (satellite-AIS derived; ArcGIS REST, open). 2025-01-01 .. latest.
Writes derived/portwatch_daily.csv (port calls and estimated cargo flows by port)."""
import csv, json, os, sys, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "derived", "portwatch_daily.csv")
URL = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Ports_Data/FeatureServer/0/query"
PORTS = {  # id: group  (Gulf / Red Sea+Suez / Eastern Med / Control)
 "port744": "Gulf", "port362": "Gulf", "port2025": "Gulf", "port306": "Gulf", "port1090": "Gulf", "port275": "Gulf", "port24": "Gulf", "port1091": "Gulf",
 "port2067": "Gulf", "port1341": "Gulf", "port106": "Gulf", "port988": "Gulf", "port746": "Gulf",
 "port518": "Red Sea", "port570": "Red Sea", "port19": "Red Sea", "port294": "Red Sea", "port192": "Red Sea",
 "port23": "East Med", "port435": "East Med", "port73": "East Med", "port274": "East Med",
 "port1201": "Control", "port1114": "Control",
}
FIELDS = ["date", "portid", "portname", "ISO3", "portcalls", "portcalls_tanker", "portcalls_cargo", "import", "export"]
rows = []
for pid, grp in PORTS.items():
    off = 0
    while True:
        q = {"where": f"portid='{pid}' AND date >= timestamp '2025-01-01 00:00:00'", "outFields": ",".join(FIELDS), "returnGeometry": "false", "resultOffset": off, "resultRecordCount": 1000, "orderByFields": "date", "f": "json"}
        req = urllib.request.Request(URL + "?" + urllib.parse.urlencode(q), headers={"User-Agent": "globalwatch-research/1.0 (non.ar@depa.or.th)"})
        d = json.load(urllib.request.urlopen(req, timeout=90)); fs = d.get("features", [])
        for f in fs: a = f["attributes"]; rows.append([grp] + [a.get(k) for k in FIELDS])
        if len(fs) < 1000: break
        off += 1000
    print(pid, grp, sum(1 for r in rows if r[2] == pid), file=sys.stderr)
with open(OUT, "w", newline="") as f:
    w = csv.writer(f); w.writerow(["group"] + FIELDS); w.writerows(rows)
print(len(rows), "rows ->", OUT)
