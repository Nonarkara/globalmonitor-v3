#!/usr/bin/env python3
"""Ships that still call: port-call change after 28 Feb 2026 against control ports (IMF PortWatch daily data)."""
import csv, json, os, collections, datetime as dt
import numpy as np
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt, matplotlib.dates as mdates
import style; style.apply()
HERE = os.path.dirname(os.path.abspath(__file__)); DER = os.path.join(HERE, "..", "derived"); FIG = os.path.join(HERE, "..", "figures")
rows = list(csv.DictReader(open(os.path.join(DER, "portwatch_daily.csv"))))
GROUP = {  # analysis groups (geography, not data-driven)
 "Inside the Gulf": ["Jebel Ali", "Khalifa Port", "Dubai", "Ras Laffan", "Dammam", "Jubail", "Shuaiba", "Umm Qasr", "Bandar Shahid Rajaee"],
 "Gulf of Oman coast": ["Fujairah", "Port of Sohar"], "Red Sea and Suez": ["Jeddah", "Djibouti", "Port Said"],
 "Eastern Mediterranean": ["Alexandria", "Haifa", "Ashdod", "Damietta"], "Control (Singapore, Rotterdam)": ["Singapore", "Rotterdam"]}
dates = sorted({r["date"] for r in rows}); PRE = ("2025-01-01", "2026-02-27"); POST = ("2026-03-01", dates[-1])
def series(ports, col="portcalls"):
    s = collections.defaultdict(float)
    for r in rows:
        if r["portname"] in ports: s[r["date"]] += float(r[col] or 0)
    return np.array([s[d] for d in dates])
D = np.array(dates)
def window(a, w): m = (D >= w[0]) & (D <= w[1]); return a[m]
rng = np.random.default_rng(7)
def block_boot_ratio(a, b, n=4000, blk=7):
    """Ratio of means (post/pre) with moving-block bootstrap CI (7-day blocks to respect weekly cycles)."""
    def resample(x): k = int(np.ceil(len(x) / blk)); st = rng.integers(0, len(x) - blk + 1, k); return np.concatenate([x[s:s + blk] for s in st])[:len(x)]
    r = np.array([resample(b).mean() / resample(a).mean() for _ in range(n)]); return np.quantile(r, [.025, .975])
out = {"window_pre": PRE, "window_post": POST, "n_days_pre": int(((D >= PRE[0]) & (D <= PRE[1])).sum()), "n_days_post": int(((D >= POST[0]) & (D <= POST[1])).sum()), "groups": {}, "ports": {}}
ctrl = series(GROUP["Control (Singapore, Rotterdam)"]); cr = window(ctrl, POST).mean() / window(ctrl, PRE).mean()
for g, ports in GROUP.items():
    for col in ("portcalls", "portcalls_tanker"):
        s = series(ports, col); a, b = window(s, PRE), window(s, POST); r = b.mean() / a.mean(); lo, hi = block_boot_ratio(a, b)
        out["groups"].setdefault(g, {})[col] = {"pre_mean_per_day": round(float(a.mean()), 1), "post_mean_per_day": round(float(b.mean()), 1), "ratio": round(float(r), 2), "ci95": [round(float(lo), 2), round(float(hi), 2)], "ratio_vs_control": round(float(r / (window(series(GROUP['Control (Singapore, Rotterdam)'], col), POST).mean() / window(series(GROUP['Control (Singapore, Rotterdam)'], col), PRE).mean())), 2)}
for g, ports in GROUP.items():
    for p in ports:
        s = series([p]); a, b = window(s, PRE), window(s, POST); out["ports"][p] = {"group": g, "pre": round(float(a.mean()), 1), "post": round(float(b.mean()), 1), "ratio": round(float(b.mean() / a.mean()), 2)}
# monthly path of the inside-Gulf aggregate (ratio to pre-period mean)
ins = series(GROUP["Inside the Gulf"]); base = window(ins, PRE).mean(); months = collections.OrderedDict()
for d, v in zip(dates, ins):
    if d >= "2026-02-01": months.setdefault(d[:7], []).append(v)
out["inside_gulf_monthly_ratio"] = {m: round(float(np.mean(v) / base), 2) for m, v in months.items()}
# sensitivity: Red Sea group without Jeddah (one port drives the late decline), and Jeddah's own late-period ratio
ex = series(["Djibouti", "Port Said"]); a_, b_ = window(ex, PRE), window(ex, POST); lo_, hi_ = block_boot_ratio(a_, b_)
out["red_sea_excl_jeddah"] = {"ratio": round(float(b_.mean() / a_.mean()), 2), "ci95": [round(float(lo_), 2), round(float(hi_), 2)]}
jd = series(["Jeddah"]); out["jeddah_oct_ratio"] = round(float(jd[(D >= "2026-10-01")].mean() / window(jd, PRE).mean()), 2); out["jeddah_jun_ratio"] = round(float(jd[(D >= "2026-06-01") & (D < "2026-07-01")].mean() / window(jd, PRE).mean()), 2)
out["red_sea_group_oct_ratio"] = round(float(series(GROUP["Red Sea and Suez"])[(D >= "2026-10-01")].mean() / window(series(GROUP["Red Sea and Suez"]), PRE).mean()), 2)
json.dump(out, open(os.path.join(DER, "port_stats.json"), "w"), indent=1)
print(json.dumps({k: out[k] for k in ("groups", "inside_gulf_monthly_ratio")}, indent=1))
# ---- Figure
fig, ax = plt.subplots(1, 2, figsize=(7.1, 2.65), gridspec_kw={"width_ratios": [1.3, 1]}); a = ax[0]
x = np.array([dt.date.fromisoformat(d) for d in dates]); roll = lambda v: np.convolve(v, np.ones(7) / 7, mode="same")
cols = {"Inside the Gulf": style.RED, "Gulf of Oman coast": "#c98a7b", "Red Sea and Suez": style.INK2, "Eastern Mediterranean": style.INK3, "Control (Singapore, Rotterdam)": style.GREEN}
for g, ports in GROUP.items():
    s = series(ports); y = 100 * roll(s) / window(s, PRE).mean(); m = x >= dt.date(2025, 7, 1)
    a.plot(x[m][3:-3], y[m][3:-3], color=cols[g], lw=1.2 if g.startswith(("Inside", "Control")) else 0.9, label=g)
a.axvline(dt.date(2026, 2, 28), color=style.INK2, lw=0.6, ls=":"); a.axhline(100, color=style.LINE, lw=0.6); a.set_ylim(0, 150)
a.set_ylabel("daily port calls, 7-day mean\n(Jan 2025 – 27 Feb 2026 mean = 100)"); a.xaxis.set_major_formatter(mdates.DateFormatter("%b\n%y")); a.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
a.legend(loc="lower left", fontsize=6.3); a.set_title("A  Who still gets visited", loc="left", fontweight="bold")
b = ax[1]; order = sorted(out["ports"].items(), key=lambda kv: kv[1]["ratio"]); yy = np.arange(len(order))
b.barh(yy, [100 * v["ratio"] for _, v in order], color=[cols[v["group"]] for _, v in order], height=0.68); b.set_yticks(yy); b.set_yticklabels([k for k, _ in order], fontsize=6.0)
b.axvline(100, color=style.INK2, lw=0.6); b.set_xlabel("port calls after 1 Mar 2026, % of earlier mean"); b.grid(axis="y", visible=False); b.set_title("B  Port by port", loc="left", fontweight="bold")
fig.tight_layout(w_pad=1.0); fig.savefig(os.path.join(FIG, "fig_ports.pdf"))
