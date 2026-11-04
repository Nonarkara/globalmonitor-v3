#!/usr/bin/env python3
"""Economic pulse: event-style analysis of daily closes around the 28 Feb 2026 start of the conflict.
Inputs: Yahoo Finance daily charts (unofficial; see paper). Outputs: derived/market_*.{csv,json}, figures/fig_markets.pdf.
Everything is descriptive: one event, many confounders. No causal claim is made.
"""
import json, os, math, datetime as dt, csv, sys
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
import style; style.apply()
HERE = os.path.dirname(os.path.abspath(__file__)); DER = os.path.join(HERE, "..", "derived"); FIG = os.path.join(HERE, "..", "figures")
DATA = os.environ.get("GW_DATA", "/Volumes/Data/agent-scratch/gm-research/data")
def load(path, field="close"):
    d = json.load(open(path))["chart"]["result"][0]; q = d["indicators"]["quote"][0]
    out = {}
    for t, v in zip(d["timestamp"], q[field]):
        if v is not None: out[dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime("%Y-%m-%d")] = float(v)
    return out
T = {  # ticker file -> label
 "BZ_F": "Brent", "CL_F": "WTI", "TTF_F": "TTF gas", "GC_F": "Gold", "_GSPC": "S&P 500", "_VIX": "VIX",
 "DAL": "Delta", "UAL": "United", "AF.PA": "Air France-KLM", "LHA.DE": "Lufthansa",
 "FRO": "Frontline", "STNG": "Scorpio Tankers", "INSW": "Intl Seaways", "ZIM": "ZIM", "MAERSK_B.CO": "Maersk",
 "LMT": "Lockheed", "NOC": "Northrop", "RTX": "RTX", "XLE": "Energy ETF", "_TA125.TA": "TA-125",
}
closes = {lab: load(os.path.join(DATA, "yahoo", f + ".json")) for f, lab in T.items()}
highs = load(os.path.join(DATA, "yahoo", "BZ_F.json"), "high")
dates = sorted(closes["Brent"])  # trading calendar of the Brent contract
def asof(series, d):  # last close on or before d
    ds = [x for x in series if x <= d]; return series[max(ds)] if ds else float("nan")
BASE, FIRST = "2026-02-27", "2026-03-02"   # last close before Saturday 28 Feb; first session after
LAST = dates[-1]
pk_d = max(closes["Brent"], key=closes["Brent"].get)
def idx(d): return dates.index(d)
marks = {"first session (2 Mar)": FIRST, "+5 sessions": dates[idx(FIRST) + 4], "+20 sessions": dates[idx(FIRST) + 19], "Brent peak close": pk_d, f"latest ({LAST})": LAST}
rows = []
for lab in T.values():
    b = asof(closes[lab], BASE); r = {"asset": lab, "base_close": round(b, 2)}
    for m, d in marks.items(): r[m] = round(100 * (asof(closes[lab], d) / b - 1), 1)
    rows.append(r)
with open(os.path.join(DER, "market_event_table.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
# daily closes for reproducibility (wide, 2026)
allD = sorted(set().union(*[set(s) for s in closes.values()]))
with open(os.path.join(DER, "closes_2026.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(["date"] + list(T.values()))
    for d in allD: w.writerow([d] + [round(closes[l][d], 4) if d in closes[l] else "" for l in T.values()])
# volatility regimes and correlations
def logret(lab, d0, d1):
    ds = [d for d in dates if d0 <= d <= d1 and d in closes[lab]]
    return ds[1:], np.diff(np.log([closes[lab][d] for d in ds]))
PRE = ("2026-01-02", BASE); POST = (FIRST, LAST)
vol = {}
for lab in ("Brent", "WTI", "S&P 500", "Gold", "Delta", "Frontline"):
    _, a = logret(lab, *PRE); _, b = logret(lab, *POST)
    vol[lab] = {"pre_daily_sd_%": round(100 * a.std(ddof=1), 2), "post_daily_sd_%": round(100 * b.std(ddof=1), 2), "n_pre": len(a), "n_post": len(b)}
def corr_ci(x, y):
    n = len(x); r = float(np.corrcoef(x, y)[0, 1]); z = math.atanh(r); se = 1 / math.sqrt(n - 3)
    return r, math.tanh(z - 1.96 * se), math.tanh(z + 1.96 * se), n
air = ["Delta", "United", "Air France-KLM", "Lufthansa"]
def basket(labs, d0, d1):
    cols = []
    for l in labs:
        ds, r = logret(l, d0, d1); cols.append(dict(zip(ds, r)))
    common = sorted(set.intersection(*[set(c) for c in cols]))
    return common, np.array([[c[d] for d in common] for c in cols]).mean(axis=0)
cor = {}
for name, (d0, d1) in {"pre": PRE, "post": POST}.items():
    dB, rB = logret("Brent", d0, d1); dA, rA = basket(air, d0, d1)
    com = sorted(set(dB) & set(dA)); x = np.array([dict(zip(dB, rB))[d] for d in com]); y = np.array([dict(zip(dA, rA))[d] for d in com])
    r, lo, hi, n = corr_ci(x, y); cor[name] = {"r_brent_airlines": round(r, 2), "ci95": [round(lo, 2), round(hi, 2)], "n": n}
# Brent-WTI spread
spr = {d: closes["Brent"][d] - closes["WTI"][d] for d in dates if d in closes["WTI"]}
spread = {"pre_mean": round(float(np.mean([v for d, v in spr.items() if PRE[0] <= d <= PRE[1]])), 2), "post_mean": round(float(np.mean([v for d, v in spr.items() if POST[0] <= d <= POST[1]])), 2),
          "max": [max(spr, key=spr.get), round(max(spr.values()), 2)]}
# Audit of the dashboard's hand-curated milestone ("Oil Spikes $140", 4 Mar 2026)
mar = [d for d in dates if "2026-03-01" <= d <= "2026-03-31"]
audit = {"claimed_brent_usd": 140, "claim_date": "2026-03-04", "brent_close_claim_date": round(closes["Brent"]["2026-03-04"], 2),
         "max_close_march": [max(mar, key=closes["Brent"].get), round(max(closes["Brent"][d] for d in mar), 2)],
         "max_intraday_high_2026": [max(highs, key=highs.get), round(max(highs.values()), 2)],
         "sessions_at_or_above_140": sum(1 for d in dates if highs.get(d, 0) >= 140)}
# Long-run context: where does the post-onset move rank among all rolling windows since 2015? vs 2022 invasion
L = load(os.path.join(DATA, "yahoo_long", "BZ_F.json")); Ld = sorted(L); Lv = np.array([L[d] for d in Ld])
def roll(h): return np.log(Lv[h:] / Lv[:-h])
ctx = {}
for h in (5, 20):
    r = roll(h); i0 = Ld.index(BASE); tgt = math.log(Lv[i0 + h] / Lv[i0]); ctx[f"h{h}"] = {"log_change_pct": round(100 * tgt, 1), "percentile_since_2015": round(float((r < tgt).mean() * 100), 1), "n_windows": int(len(r))}
def path(base_d, n=60):
    i = Ld.index(base_d); return 100 * Lv[i:i + n + 1] / Lv[i]
p22, p26 = path("2022-02-23"), path(BASE)
ctx["ukraine2022_vs_2026"] = {"brent_+20_sessions_%": [round(float(p22[20] - 100), 1), round(float(p26[20] - 100), 1)], "brent_+60_sessions_%": [round(float(p22[60] - 100), 1), round(float(p26[60] - 100), 1)]}
out = {"base": BASE, "marks": marks, "vol": vol, "corr_brent_airlines": cor, "brent_wti_spread": spread, "milestone_audit": audit, "context": ctx, "n_sessions_2026": len(dates), "range": [dates[0], LAST]}
json.dump(out, open(os.path.join(DER, "market_stats.json"), "w"), indent=1)
# ---- Figure: 2 panels (A normalised paths; B Brent with realised vol + 2022 comparison)
fig, ax = plt.subplots(1, 2, figsize=(7.1, 2.55), gridspec_kw={"width_ratios": [1.35, 1]})
a = ax[0]; start = "2026-02-02"; ds = [d for d in dates if start <= d <= LAST]; x = [dt.date.fromisoformat(d) for d in ds]
def norm(lab): return [100 * asof(closes[lab], d) / asof(closes[lab], BASE) for d in ds]
tank = np.mean([norm(l) for l in ("Frontline", "Scorpio Tankers", "Intl Seaways")], axis=0)
air_n = np.mean([norm(l) for l in air], axis=0); dfn = np.mean([norm(l) for l in ("Lockheed", "Northrop", "RTX")], axis=0)
for y, lab, c, ls in [(norm("Brent"), "Brent", style.INK, "-"), (tank, "tankers (3)", style.RED, "-"), (dfn, "defence (3)", style.INK2, "-"), (air_n, "airlines (4)", style.GREEN, "-"), (norm("S&P 500"), "S&P 500", style.INK3, "--")]:
    a.plot(x, y, color=c, ls=ls, label=lab, lw=1.1 if lab == "Brent" else 0.9)
a.axvline(dt.date(2026, 2, 28), color=style.INK2, lw=0.6, ls=":"); a.text(dt.date(2026, 3, 3), 74, "28 Feb", fontsize=6.3, color=style.INK2, va="bottom")
a.set_ylim(70, 168); a.set_ylabel("close, 27 Feb 2026 = 100"); [h.set_linewidth(1.8) for h in a.legend(ncol=5, loc="upper center", bbox_to_anchor=(0.5, -0.16), fontsize=6.4, columnspacing=1.0, handlelength=1.6).get_lines()]; a.set_title("A  Same shock, different books", loc="left", fontweight="bold")
import matplotlib.dates as mdates; a.xaxis.set_major_formatter(mdates.DateFormatter("%b")); a.xaxis.set_major_locator(mdates.MonthLocator())
b = ax[1]; n = np.arange(61)
b.plot(n, p22, color=style.INK3, label="Ukraine invasion (24 Feb 2022)"); b.plot(n, p26, color=style.RED, label="This conflict (28 Feb 2026)")
b.axhline(100, color=style.LINE, lw=0.6); b.set_xlabel("trading sessions after the last pre-war close"); b.set_ylabel("Brent, last pre-war close = 100")
b.legend(loc="upper left"); b.set_title("B  Brent against the 2022 precedent", loc="left", fontweight="bold")
fig.tight_layout(w_pad=1.2); fig.savefig(os.path.join(FIG, "fig_markets.pdf")); print(json.dumps(out, indent=1)[:3500])
