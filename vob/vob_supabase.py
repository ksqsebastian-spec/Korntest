#!/usr/bin/env python3
"""VOB OCDS -> Supabase (schema vob). Fetches rolling 2-month Hamburg window,
matches the 3 active companies, enriches deadlines, dedups vs seen urls,
emits ONE atomic CTE-SQL (vob_scans -> vob_tenders -> vob_matches).
urgency is NOT written (computed by the vob_dashboard view).

Usage: python3 vob_supabase.py [--seen seen.txt] [--out scan.sql]
"""
import os, sys, json, argparse, tempfile, time
from datetime import datetime, timezone, date
import requests
from vobcore import load
from matching_db import match_companies
from enrich import enrich
from build import kategorie

API = "https://oeffentlichevergabe.de/api/notice-exports?pubMonth={}"
HDR = {"accept": "application/vnd.bekanntmachungsservice.csv.zip+zip"}

def months(today):
    cur = f"{today.year:04d}-{today.month:02d}"
    py, pm = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
    return [cur, f"{py:04d}-{pm:02d}"]

def download(pm, wd):
    path = os.path.join(wd, f"export_{pm}.zip")
    for a in range(4):
        try:
            r = requests.get(API.format(pm), headers=HDR, timeout=120); r.raise_for_status()
            open(path, "wb").write(r.content); return path
        except Exception:
            if a == 3: raise
            time.sleep(2 ** (a + 1))

def q(s):  # SQL string literal
    return "'" + (s or "").replace("'", "''") + "'"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seen", default=None)
    ap.add_argument("--out", default="scan.sql")
    args = ap.parse_args()

    seen = set()
    if args.seen and os.path.exists(args.seen):
        seen = {l.strip() for l in open(args.seen) if l.strip()}

    now = datetime.now(timezone.utc); today = now.date()
    wd = tempfile.mkdtemp(prefix="vobsb_")
    zips = [download(pm, wd) for pm in months(today)]

    data = load(zips)
    hamburg = data["hamburg"]
    total_listings = len(hamburg)

    new = [t for t in hamburg if f"https://oeffentlichevergabe.de/api/notices/{t['nid']}" not in seen]
    new_listings = len(new)

    matched = []
    for t in new:
        m = match_companies(t)
        if m:
            t["firms"] = m
            matched.append(t)

    final, expired = enrich(matched, now)  # deadlines + drop expired + dedup title/buyer

    # ---- build atomic SQL ----
    cw = today.isocalendar()[1]; yr = today.year
    tender_rows, match_rows = [], []
    for t in final:
        url = f"https://oeffentlichevergabe.de/api/notices/{t['nid']}"
        deadline_raw = f"{t['frist']} ({t['frist_typ']})" if t["frist"] else None
        dd = t["frist"][:10] if t["frist"] else None
        cat = kategorie(t["natures"], t["cpv"])
        tender_rows.append(f"({q(t['title'])}, {q(t['buyer'])}, "
                           f"{q(deadline_raw) if deadline_raw else 'NULL'}, "
                           f"{q(dd)+'::date' if dd else 'NULL'}, {q(cat)}, {q(url)})")
        for slug, d in t["firms"].items():
            match_rows.append(f"({q(url)}, {q(slug)}, {q(d['rel'])}, {q(d['reason'])})")

    matched_count = len(final)
    if not final:
        print(json.dumps({"total_listings": total_listings, "new_listings": new_listings,
                          "matched_count": 0, "note": "nichts zu schreiben"}, ensure_ascii=False))
        open(args.out, "w").write("-- nichts zu schreiben\n")
        return

    sep = ",\n    "
    tenders_sql = sep.join(tender_rows)
    matches_sql = sep.join(match_rows)

    sql = f"""-- VOB OCDS daily scan -> schema vob (atomic, weekly upsert)
with scan as (
  insert into vob.vob_scans (scan_date, calendar_week, year, total_listings, matched_count, new_listings)
  values (current_date, {cw}, {yr}, {total_listings}, {matched_count}, {new_listings})
  on conflict (calendar_week, year) do update set
    scan_date = current_date,
    total_listings = excluded.total_listings,
    matched_count = vob.vob_scans.matched_count + excluded.matched_count,
    new_listings = vob.vob_scans.new_listings + excluded.new_listings
  returning id
),
t as (
  insert into vob.vob_tenders (title, authority, deadline, deadline_date, category, url, status, scan_id)
  select v.title, v.authority, v.deadline, v.deadline_date, v.category, v.url, 'active', scan.id
  from scan, (values
    {tenders_sql}
  ) as v(title, authority, deadline, deadline_date, category, url)
  returning id, url
),
m as (
  insert into vob.vob_matches (tender_id, company_id, company_slug, relevance, reason)
  select t.id, c.id, mm.slug, mm.relevance, mm.reason
  from (values
    {matches_sql}
  ) as mm(url, slug, relevance, reason)
  join t on t.url = mm.url
  join vob.companies c on c.slug = mm.slug
  returning id
)
select (select id from scan) as scan_id,
       (select count(*) from t) as tenders_written,
       (select count(*) from m) as matches_written;
"""
    open(args.out, "w").write(sql)

    from collections import defaultdict
    fc = defaultdict(int)
    for t in final:
        for s in t["firms"]: fc[s] += 1
    print(json.dumps({
        "months": months(today), "total_listings": total_listings,
        "new_listings": new_listings, "matched_count": matched_count,
        "expired_dropped": len(expired), "firmen": dict(fc), "sql": os.path.abspath(args.out)
    }, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
