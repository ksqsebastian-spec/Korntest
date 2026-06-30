#!/usr/bin/env python3
"""Build the output CSV. Importable: build_csv(final, today, new_days=2) -> csv string."""
import csv, io, re
from datetime import date

RANK = {"mittel": 1, "hoch": 2, "sehr hoch": 3}
HEADER = ["Neu", "Titel", "Auftraggeber", "CPV", "Kategorie", "Frist",
          "Match-Firmen", "Relevanz", "Begründung", "URL"]

def kategorie(natures, cpvs=()):
    s = set(natures)
    if "works" in s: return "Bauleistung"
    if "services" in s: return "Planung-Dienstleistung"
    if "supplies" in s: return "Lieferung"
    if any(c.startswith("71") for c in cpvs): return "Planung-Dienstleistung"
    if any(c.startswith("45") or c.startswith("44") for c in cpvs): return "Bauleistung"
    return ""

def _pubdate(s):
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s or "")
    return date(int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None

def build_csv(final, today, new_days=2):
    rows = []
    for t in final:
        firms = t["firms"]
        ordered = sorted(firms.items(), key=lambda kv: -RANK[kv[1]["rel"]])
        pd = _pubdate(t.get("pub", ""))
        neu = "🆕" if (pd and (today - pd).days <= new_days) else ""
        rows.append({
            "Neu": neu,
            "Titel": t["title"],
            "Auftraggeber": t["buyer"],
            "CPV": "; ".join(t["cpv"][:8]),
            "Kategorie": kategorie(t["natures"], t["cpv"]),
            "Frist": f"{t['frist']} ({t['frist_typ']})" if t["frist"] else "",
            "Match-Firmen": "; ".join(f"{f} ({d['rel']})" for f, d in ordered),
            "Relevanz": max((d["rel"] for d in firms.values()), key=lambda r: RANK[r]),
            "Begründung": " | ".join(f"{f}: {d['reason']}" for f, d in ordered),
            "URL": f"https://oeffentlichevergabe.de/api/notices/{t['nid']}",
            "_sort": t["frist"] or "9999",
        })
    rows.sort(key=lambda r: r["_sort"])
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=HEADER, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    return buf.getvalue()
