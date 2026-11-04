#!/usr/bin/env python3
"""Generate paper/generated/*.tex (numbers macros + tables) from derived/*.json|csv so that every number in the PDF is traceable to a script output."""
import json, csv, os, datetime as dt
HERE = os.path.dirname(os.path.abspath(__file__)); DER = os.path.join(HERE, "..", "derived"); OUT = os.path.join(HERE, "..", "paper", "generated"); os.makedirs(OUT, exist_ok=True)
J = lambda n: json.load(open(os.path.join(DER, n)))
mk, pt, ais, fi, air = J("market_stats.json"), J("port_stats.json"), J("ais_chokepoints.json"), J("firms_persistence.json"), J("air_density.json")
def sg(v, d=1):  # signed number for tables
    s = f"{abs(v):,.{d}f}"; return f"$+${s}" if v > 0 else (f"$-${s}" if v < 0 else s)
def pc(x, d=0): return f"{100 * x:.{d}f}\\%"
M = {}
def neg(x):  # typographic minus for text-mode macros
    return str(x).replace("-", "$-$")
def m(name, val): M[name] = val
# ---- markets
tbl = {r["asset"]: r for r in csv.DictReader(open(os.path.join(DER, "market_event_table.csv")))}
keys = list(tbl["Brent"].keys()); peakk = "Brent peak close"; lastk = [k for k in keys if k.startswith("latest")][0]
b = tbl["Brent"]; closes = {r["date"]: r for r in csv.DictReader(open(os.path.join(DER, "closes_2026.csv")))}
m("NSessions", mk["n_sessions_2026"]); m("BrentBase", f"{float(b['base_close']):.2f}"); m("BrentFirst", b["first session (2 Mar)"]); m("BrentFive", b["+5 sessions"]); m("BrentTwenty", b["+20 sessions"])
m("BrentPeakPct", b[peakk]); m("BrentPeakClose", f"{mk['milestone_audit']['max_close_march'][1]:.2f}"); m("BrentLatestPct", b[lastk]); m("BrentLatest", f"{float(closes[mk['range'][1]]['Brent']):.2f}")
m("VolPre", mk["vol"]["Brent"]["pre_daily_sd_%"]); m("VolPost", mk["vol"]["Brent"]["post_daily_sd_%"]); m("SPPre", mk["vol"]["S&P 500"]["pre_daily_sd_%"]); m("SPPost", mk["vol"]["S&P 500"]["post_daily_sd_%"])
c = mk["corr_brent_airlines"]; m("CorrPre", neg(c["pre"]["r_brent_airlines"])); m("CorrPost", neg(c["post"]["r_brent_airlines"])); m("CorrPreCI", neg(f"{c['pre']['ci95'][0]} to {c['pre']['ci95'][1]}")); m("CorrPostCI", neg(f"{c['post']['ci95'][0]} to {c['post']['ci95'][1]}"))
m("SpreadPre", mk["brent_wti_spread"]["pre_mean"]); m("SpreadPost", mk["brent_wti_spread"]["post_mean"]); m("SpreadMax", mk["brent_wti_spread"]["max"][1])
cx = mk["context"]; m("PctileFive", cx["h5"]["percentile_since_2015"]); m("PctileTwenty", cx["h20"]["percentile_since_2015"]); m("LogTwenty", cx["h20"]["log_change_pct"])
u = cx["ukraine2022_vs_2026"]; m("UkrTwenty", u["brent_+20_sessions_%"][0]); m("WarTwenty", u["brent_+20_sessions_%"][1]); m("UkrSixty", u["brent_+60_sessions_%"][0]); m("WarSixty", u["brent_+60_sessions_%"][1])
a = mk["milestone_audit"]; m("AuditClaim", a["claimed_brent_usd"]); m("AuditClose", f"{a['brent_close_claim_date']:.2f}"); m("AuditHigh", f"{a['max_intraday_high_2026'][1]:.2f}"); m("AuditHighDate", dt.date.fromisoformat(a["max_intraday_high_2026"][0]).strftime("%-d %B"))
m("GoldAbs", abs(float(tbl["Gold"][lastk]))); m("FrontlineTwentyAbs", abs(float(tbl["Frontline"]["+20 sessions"]))); m("LufthansaAbs", abs(float(tbl["Lufthansa"][lastk]))); m("AFAbs", abs(float(tbl["Air France-KLM"][lastk]))); m("TTFLatest", tbl["TTF gas"][lastk]); m("DeltaLatest", tbl["Delta"][lastk]); m("LufthansaLatest", tbl["Lufthansa"][lastk]); m("AFLatest", tbl["Air France-KLM"][lastk]); m("FrontlineLatest", tbl["Frontline"][lastk]); m("MaerskLatest", tbl["Maersk"][lastk])
m("RangeStart", dt.date.fromisoformat(mk["range"][0]).strftime("%-d %B %Y")); m("RangeEnd", dt.date.fromisoformat(mk["range"][1]).strftime("%-d %B %Y"))
# ---- ports
g = pt["groups"]; gi = g["Inside the Gulf"]["portcalls"]; m("GulfPre", gi["pre_mean_per_day"]); m("GulfPost", gi["post_mean_per_day"]); m("GulfRatio", int(round(100 * gi["ratio"]))); m("GulfLo", int(round(100 * gi["ci95"][0]))); m("GulfHi", int(round(100 * gi["ci95"][1])))
gt = g["Inside the Gulf"]["portcalls_tanker"]; m("GulfTankPre", gt["pre_mean_per_day"]); m("GulfTankPost", gt["post_mean_per_day"]); m("GulfTankRatio", int(round(100 * gt["ratio"])))
m("OmanRatio", int(round(100 * g["Gulf of Oman coast"]["portcalls"]["ratio"]))); r = g["Red Sea and Suez"]["portcalls"]; m("RedRatio", int(round(100 * r["ratio"]))); m("RedLo", int(round(100 * r["ci95"][0]))); m("RedHi", int(round(100 * r["ci95"][1])))
m("MedRatio", int(round(100 * g["Eastern Mediterranean"]["portcalls"]["ratio"]))); m("CtrlRatio", int(round(100 * g["Control (Singapore, Rotterdam)"]["portcalls"]["ratio"])))
mo = pt["inside_gulf_monthly_ratio"]
for k, name in (("2026-03", "GulfMar"), ("2026-05", "GulfMay"), ("2026-07", "GulfJul"), ("2026-10", "GulfOct")): m(name, int(round(100 * mo[k])))
m("RedExJeddah", int(round(100 * pt["red_sea_excl_jeddah"]["ratio"]))); m("JeddahJun", int(round(100 * pt["jeddah_jun_ratio"]))); m("JeddahOct", int(round(100 * pt["jeddah_oct_ratio"]))); m("RedOct", int(round(100 * pt["red_sea_group_oct_ratio"])))
m("PortDaysPre", pt["n_days_pre"]); m("PortDaysPost", pt["n_days_post"])
# ---- AIS (headline = first snapshot; range across snapshots reported too)
s0 = ais[0]; bx = s0["boxes"]; m("AisTotal", f"{s0['n_total']:,}"); m("AisFresh", f"{s0['n_fresh_6h']:,}"); m("AisFreshPct", f"{100 * s0['share_fresh_6h']:.1f}"); m("AisMedianAge", int(s0["age_h_quantiles_10_50_90"][1])); m("AisPnineAge", f"{int(s0['age_h_quantiles_10_50_90'][2]):,}")
m("AisSnaps", len(ais)); _t=[dt.datetime.fromisoformat(x["snapshot"]) for x in ais]; m("AisSpanMin", int(round((max(_t)-min(_t)).total_seconds()/60))); m("AisFreshMin", f"{100 * min(x['share_fresh_6h'] for x in ais):.1f}"); m("AisFreshMax", f"{100 * max(x['share_fresh_6h'] for x in ais):.1f}")
def box(name, key): return bx[name][key]
for name, mac in (("Hormuz", "Hormuz"), ("Persian Gulf", "PGulf"), ("Gulf of Oman", "GOman"), ("Red Sea", "RedSea"), ("Bab el-Mandeb", "BabEl"), ("Suez", "Suez"), ("Malacca", "Malacca"), ("North Sea", "NSea"), ("Baltic", "Baltic"), ("Cape (S. Africa)", "Cape")):
    n_all, n_f = box(name, "n_all_ages"), box(name, "n"); m(mac + "All", f"{n_all:,}"); m(mac + "Fresh", f"{n_f:,}"); m(mac + "FreshPct", f"{100 * n_f / n_all:.1f}" if n_all else "--")
# ---- FIRMS
m("FirmsRows", f"{fi['rows_total']:,}"); m("FirmsDays", fi["n_days"]); m("FirmsFrom", dt.date.fromisoformat(fi["dates"][0]).strftime("%-d %B")); m("FirmsTo", dt.date.fromisoformat(fi["dates"][1]).strftime("%-d %B %Y"))
R = fi["regions"]; m("FirmsGulfChronic", int(round(100 * R["Persian Gulf basin"]["chronic_share"]))); m("FirmsGulfCells", f"{R['Persian Gulf basin']['cells']:,}"); m("FirmsGulfBig", R["Persian Gulf basin"]["transient_frp_ge_50MW"])
m("FirmsOtherChronicMax", int(round(100 * max(R[k]["chronic_share"] for k in R if k != "Persian Gulf basin"))))
# ---- air
ME = air["regions"]["middleeast"]; EU = air["regions"]["europe"]; SE = air["regions"]["seasia"]; m("AirN", air["n_samples"]); m("AirME", f"{ME['airborne_mean']:.0f}"); m("AirEU", f"{EU['airborne_mean']:,.0f}"); m("AirSEA", f"{SE['airborne_mean']:.0f}")
m("AirMELo", ME["airborne_range"][0]); m("AirMEHi", ME["airborne_range"][1]); dens = {r["country"]: r for r in ME["countries"]}
for cn, mac in (("United Arab Emirates", "UAE"), ("Iran", "Iran"), ("Iraq", "Iraq"), ("Egypt", "Egypt"), ("Saudi Arabia", "Saudi"), ("Turkey", "Turkey"), ("Israel", "Israel"), ("Jordan", "Jordan"), ("Syria", "Syria")):
    if cn in dens: m("Dens" + mac, f"{dens[cn]['per_1e5km2']:.1f}"); m("Mean" + mac, f"{dens[cn]['mean_aircraft']:.1f}")
import statistics as st
m("AirEUMedian", f"{st.median([r['per_1e5km2'] for r in EU['countries']]):.1f}"); m("AirSEAMedian", f"{st.median([r['per_1e5km2'] for r in SE['countries']]):.1f}")
with open(os.path.join(OUT, "numbers.tex"), "w") as f:
    f.write("% generated by research/scripts/make_tex_inputs.py -- do not edit\n")
    for k, v in M.items(): f.write(f"\\newcommand{{\\{k}}}{{{v}}}\n")
# ---- tables
def w(name, body): open(os.path.join(OUT, name), "w").write(body)
rows = ["Brent", "WTI", "TTF gas", "Gold", "S&P 500", "VIX", "Delta", "United", "Lufthansa", "Air France-KLM", "Frontline", "Intl Seaways", "Maersk", "Lockheed", "Northrop"]
lab = {"S&P 500": "S\\&P 500", "Intl Seaways": "International Seaways", "TTF gas": "TTF natural gas", "Air France-KLM": "Air France--KLM", "Maersk": "A.P.~M{\\o}ller--Maersk"}
ks = ["first session (2 Mar)", "+5 sessions", "+20 sessions", peakk, lastk]
t = ["\\begin{tabular}{@{}lrrrrrr@{}}\\toprule", "Asset & 27 Feb & 2 Mar & +5 & +20 & Peak & 4 Nov\\\\", " & close & \\multicolumn{5}{c}{change from 27 Feb close, \\%}\\\\\\midrule"]
for a_ in rows: t.append(f"{lab.get(a_, a_)} & {float(tbl[a_]['base_close']):,.2f} & " + " & ".join(sg(float(tbl[a_][k])) for k in ks) + "\\\\")
t.append("\\bottomrule\\end{tabular}"); w("tab_markets.tex", "\n".join(t))
t = ["\\begin{tabular}{@{}lrrcc@{}}\\toprule", "Port group & Before & After & Ratio & 95\\% CI\\\\", " & \\multicolumn{2}{c}{calls per day} & & \\\\\\midrule"]
for gname in ["Inside the Gulf", "Gulf of Oman coast", "Red Sea and Suez", "Eastern Mediterranean", "Control (Singapore, Rotterdam)"]:
    x = g[gname]["portcalls"]; t.append(f"{gname.replace('Control (Singapore, Rotterdam)', 'Control: Singapore, Rotterdam')} & {x['pre_mean_per_day']:.1f} & {x['post_mean_per_day']:.1f} & {x['ratio']:.2f} & {x['ci95'][0]:.2f}--{x['ci95'][1]:.2f}\\\\")
t.append("\\bottomrule\\end{tabular}"); w("tab_ports.tex", "\n".join(t))
t = ["\\begin{tabular}{@{}lrrrr@{}}\\toprule", "Box & Vessels & $\\le$6\\,h & \\% fresh & Median age\\\\", " & (any age) & (n) & & (hours)\\\\\\midrule"]
for name in ["North Sea", "Baltic", "Eastern Med", "Suez", "Malacca", "Taiwan Strait", "Persian Gulf", "Hormuz", "Gulf of Oman", "Red Sea", "Bab el-Mandeb"]:
    x = bx[name]; pct = f"{100 * x['n'] / x['n_all_ages']:.1f}" if x["n_all_ages"] else "--"; med = f"{x['median_age_h']:,.0f}" if x["median_age_h"] is not None else "--"
    t.append(f"{name} & {x['n_all_ages']:,} & {x['n']:,} & {pct} & {med}\\\\")
t.append("\\bottomrule\\end{tabular}"); w("tab_ais.tex", "\n".join(t))
czib = {"Iran": "Iran", "Iraq": "Iraq", "Lebanon": "Lebanon", "Jordan": "Jordan", "Saudi Arabia": "Saudi Arabia", "Syria": "Syria", "Yemen": "Yemen"}
def d8(s): return "--" if s == "N/A" else dt.datetime.strptime(s, "%d/%m/%Y").strftime("%-d %b %Y")
cz = list(csv.DictReader(open(os.path.join(DER, "easa_czib_2026-11-04.csv"))))
sel = [r for r in cz if r["reference"] in ("2026-02-R1", "2026-03-R14", "CZIB-2026-04-R2", "CZIB-2026-05-R2", "CZIB-2026-06-R2", "CZIB-2026-07R3", "CZIB-2026-08-R3", "CZIB-2026-09-R1")]
sel.sort(key=lambda r: dt.datetime.strptime(r["issue"], "%d/%m/%Y"))
t = ["\\begin{tabular}{@{}llccc@{}}\\toprule", "Airspace & Reference & Issued & Revised & Valid until\\\\\\midrule"]
for r in sel:
    subj = r["subject"].replace("Airspace of the ", "").replace("Airspace of ", "").replace("&", "\\&"); star = "$^\\dagger$" if r["status_token"] == "Withdrawn" else ""
    t.append(f"{subj}{star} & {r['reference'].replace('CZIB-', '')} & {d8(r['issue'])} & {d8(r['revision'])} & {d8(r['valid_until'])}\\\\")
t.append("\\bottomrule\\end{tabular}"); w("tab_czib.tex", "\n".join(t))
t = ["\\begin{tabular}{@{}lrrrr@{}}\\toprule", "Country & Area & Mean & per & EASA\\\\", " & (km$^2$) & aircraft & 100\\,000\\,km$^2$ & bulletin\\\\\\midrule"]
for r in [r for r in ME["countries"] if r["area_km2"] >= 2e4 and (r["mean_aircraft"] > 0 or r["czib"] or r["country"] in ("Egypt", "Turkey", "Oman"))]:
    t.append(f"{r['country']} & {r['area_km2']:,} & {r['mean_aircraft']:.1f} & {r['per_1e5km2']:.1f} & {'yes' if r['czib'] else 'no'}\\\\")
t.append("\\bottomrule\\end{tabular}"); w("tab_air.tex", "\n".join(t))
print("macros:", len(M)); print(open(os.path.join(OUT, "tab_ports.tex")).read())
