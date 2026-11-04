#!/usr/bin/env python3
"""Parse the EASA CZIB list page (saved HTML) into derived/easa_czib.csv. Header order on the page: Issue date, Revision date, Valid until."""
import re, html, csv, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SRC = sys.argv[1]; OUT = os.path.join(HERE, "..", "derived", "easa_czib_2026-11-04.csv")
s = open(SRC, errors="ignore").read(); s = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
lines = [l.strip() for l in html.unescape(re.sub(r"<[^>]+>", "\n", s)).split("\n") if l.strip()]
D = re.compile(r"^(\d{2}/\d{2}/\d{4}|N/A)$"); rows = []
for i in range(len(lines) - 5):
    if D.match(lines[i]) and D.match(lines[i + 1]) and D.match(lines[i + 2]):
        subj, ref = lines[i + 3], lines[i + 4]; status = lines[i + 5] if lines[i + 5] in ("Active", "Withdrawn") else ""
        rows.append([subj, ref, status, lines[i], lines[i + 1], lines[i + 2]])
# On the page, the status word precedes the dates of the NEXT entry in some layouts; keep raw and let the paper read only Subject/Ref/dates.
with open(OUT, "w", newline="") as f:
    w = csv.writer(f); w.writerow(["subject", "reference", "status_token", "issue", "revision", "valid_until"]); w.writerows(rows)
for r in rows: print(r)
