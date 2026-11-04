"""Small shared geometry helpers: Natural Earth land/country polygons via shapely."""
import json, os
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
DATA = os.environ.get("GW_DATA", "/Volumes/Data/agent-scratch/gm-research/data")
def land_rings():
    g = json.load(open(os.path.join(DATA, "ne_land.geojson"))); rings = []
    for f in g["features"]:
        geom = f["geometry"]; polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        for p in polys: rings.append(p[0])
    return rings
def draw_land(ax, color="#e7e5dd", edge="#bdb9ad", lw=0.25):
    for r in land_rings():
        xs, ys = zip(*r); ax.fill(xs, ys, color=color, ec=edge, lw=lw, zorder=0)
def countries():
    g = json.load(open(os.path.join(DATA, "ne_admin0.geojson"))); polys, names, iso = [], [], []
    for f in g["features"]:
        polys.append(shape(f["geometry"])); p = f["properties"]; names.append(p.get("NAME") or p.get("ADMIN")); iso.append(p.get("ISO_A3") or p.get("ADM0_A3"))
    return polys, names, iso
