#!/usr/bin/env python3
"""Deadline enrichment via Notice-XML (parallel, with retry) + drop expired + dedup.
Importable: enrich(matched, now) -> (final, expired)."""
import re
from concurrent.futures import ThreadPoolExecutor
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

CEST = timezone(timedelta(hours=2))
CBC = "{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}"
CAC = "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}"
RANK = {"mittel": 1, "hoch": 2, "sehr hoch": 3}

def _tz_of(s):
    if not s: return None
    if s.rstrip().endswith("Z"): return timezone.utc
    m = re.search(r"([+-])(\d{2}):?(\d{2})$", s)
    if not m: return None
    sign = 1 if m.group(1) == "+" else -1
    return timezone(sign * timedelta(hours=int(m.group(2)), minutes=int(m.group(3))))

def _build_dt(date_raw, time_raw):
    dm = re.match(r"(\d{4}-\d{2}-\d{2})", date_raw or "")
    if not dm: return (None, None)
    dstr = dm.group(1)
    tm = re.match(r"(\d{2}:\d{2})", time_raw or "")
    tstr = tm.group(1) if tm else None
    off = _tz_of(time_raw) or _tz_of(date_raw) or CEST
    y, mo, d = map(int, dstr.split("-"))
    hh, mi = (int(tstr[:2]), int(tstr[3:5])) if tstr else (23, 59)
    return (f"{dstr} {tstr or '23:59'}", datetime(y, mo, d, hh, mi, tzinfo=off))

def _fetch(t):
    url = f"https://oeffentlichevergabe.de/api/notices/{t['nid']}"
    last = "?"
    for _ in range(3):  # retry for unattended daily runs
        try:
            r = requests.get(url, headers={"accept": "application/xml"}, timeout=60)
            if r.status_code == 200:
                root = ET.fromstring(r.content); break
            last = f"http {r.status_code}"
        except Exception as e:
            last = f"err {type(e).__name__}"
    else:
        return (t, None, None, None, last)
    cands = []
    for p in root.iter(CAC + "TenderSubmissionDeadlinePeriod"):
        disp, dt = _build_dt(p.findtext(CBC + "EndDate"), p.findtext(CBC + "EndTime"))
        if dt: cands.append((dt, disp, "Angebot"))
    for p in root.iter(CAC + "ParticipationRequestReceptionPeriod"):
        disp, dt = _build_dt(p.findtext(CBC + "EndDate"), p.findtext(CBC + "EndTime"))
        if dt: cands.append((dt, disp, "Teilnahme"))
    if not cands:
        return (t, None, None, None, "no deadline")
    cands.sort(key=lambda c: c[0])
    dt, disp, typ = cands[0]
    return (t, disp, typ, dt.isoformat(), "ok")

def enrich(matched, now):
    """now: tz-aware datetime. Returns (final, expired)."""
    results = []
    with ThreadPoolExecutor(max_workers=12) as ex:
        for t, frist, typ, dt_iso, status in ex.map(_fetch, matched):
            t["frist"], t["frist_typ"], t["frist_dt"], t["frist_status"] = frist, typ, dt_iso, status
            results.append(t)
    alive, expired = [], []
    for t in results:
        if t["frist_dt"] and datetime.fromisoformat(t["frist_dt"]) < now:
            expired.append(t)
        else:
            alive.append(t)
    dedup = {}
    for t in alive:
        key = (t["title"].strip().lower(), t["buyer"].strip().lower())
        if key not in dedup:
            dedup[key] = t
        else:
            base = dedup[key]
            for f, d in t["firms"].items():
                if f not in base["firms"] or RANK[d["rel"]] > RANK[base["firms"][f]["rel"]]:
                    base["firms"][f] = d
            if t["frist_dt"] and (not base["frist_dt"] or t["frist_dt"] < base["frist_dt"]):
                base["frist"], base["frist_typ"], base["frist_dt"] = t["frist"], t["frist_typ"], t["frist_dt"]
    return list(dedup.values()), expired
