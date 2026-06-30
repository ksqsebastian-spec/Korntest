#!/usr/bin/env python3
"""VOB OCDS Hamburg - daily run (stateless, fast).
Fetches a rolling 2-month window (current + previous), filters Hamburg competition,
matches Gruppenwerk firms, enriches real deadlines, drops expired, writes CSV.

Usage:  python3 run_daily.py [--out DIR] [--keep-zip]
Output: <out>/final.csv  and prints a summary to stdout (sheet creation is done by the caller).
"""
import os, sys, json, argparse, tempfile
from datetime import datetime, timezone, date
import requests

from vobcore import load
from matching import match_tender
from enrich import enrich
from build import build_csv

API = "https://oeffentlichevergabe.de/api/notice-exports?pubMonth={}"
HDR = {"accept": "application/vnd.bekanntmachungsservice.csv.zip+zip"}

def months(today):
    cur = f"{today.year:04d}-{today.month:02d}"
    py, pm = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
    return [cur, f"{py:04d}-{pm:02d}"]

def download(pubmonth, workdir):
    path = os.path.join(workdir, f"export_{pubmonth}.zip")
    for attempt in range(4):  # exponential backoff on network errors
        try:
            r = requests.get(API.format(pubmonth), headers=HDR, timeout=120)
            r.raise_for_status()
            with open(path, "wb") as f:
                f.write(r.content)
            return path, len(r.content)
        except Exception as e:
            if attempt == 3:
                raise
            import time; time.sleep(2 ** (attempt + 1))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="vob_out")
    ap.add_argument("--keep-zip", action="store_true")
    args = ap.parse_args()

    now = datetime.now(timezone.utc)
    today = now.date()
    os.makedirs(args.out, exist_ok=True)
    workdir = tempfile.mkdtemp(prefix="vob_")

    t0 = datetime.now(timezone.utc)
    zips, total_bytes = [], 0
    for pm in months(today):
        p, n = download(pm, workdir); zips.append(p); total_bytes += n

    data = load(zips)
    hamburg, total_comp = data["hamburg"], data["total_competition"]

    matched = []
    for t in hamburg:
        firms = match_tender(t)
        if firms:
            t["firms"] = firms
            matched.append(t)

    final, expired = enrich(matched, now)
    csv_text = build_csv(final, today)

    csv_path = os.path.join(args.out, "final.csv")
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write(csv_text)

    if not args.keep_zip:
        for p in zips:
            try: os.remove(p)
            except OSError: pass

    # summary
    from collections import defaultdict
    fc = defaultdict(int); buckets = {"rot": 0, "gelb": 0, "gruen": 0}; neu = 0
    for t in final:
        days = (datetime.fromisoformat(t["frist_dt"]) - now).days if t["frist_dt"] else 999
        buckets["rot" if days <= 7 else ("gelb" if days <= 14 else "gruen")] += 1
        for fm in t["firms"]: fc[fm] += 1
    import re as _re
    for t in final:
        m = _re.match(r"(\d{4})-(\d{2})-(\d{2})", t.get("pub", "") or "")
        if m and (today - date(int(m[1]), int(m[2]), int(m[3]))).days <= 2: neu += 1

    secs = (datetime.now(timezone.utc) - t0).total_seconds()
    summary = {
        "now": now.isoformat(), "months": months(today),
        "download_mb": round(total_bytes / 1e6, 1),
        "total_competition": total_comp, "hamburg": len(hamburg),
        "matched": len(matched), "final": len(final), "expired": len(expired), "neu": neu,
        "buckets": buckets, "firmen": dict(sorted(fc.items(), key=lambda x: -x[1])),
        "runtime_s": round(secs, 1), "csv": os.path.abspath(csv_path),
    }
    with open(os.path.join(args.out, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=1)

    print(json.dumps(summary, ensure_ascii=False, indent=1))
    print(f"\nCSV: {csv_path}  ({len(final)} Treffer, {neu} neu, Lauf {secs:.1f}s)", file=sys.stderr)

if __name__ == "__main__":
    main()
