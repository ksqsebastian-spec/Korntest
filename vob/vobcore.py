#!/usr/bin/env python3
"""Shared core: fetch/parse the OCDS export and build the Hamburg candidate list.
Reusable across matching, recall analysis and the daily run."""
import zipfile, csv, io
from collections import defaultdict

def _rows(zips, name):
    for z in zips:
        if name in z.namelist():
            with z.open(name) as f:
                for r in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")):
                    yield r

def load(zip_paths="export.zip"):
    if isinstance(zip_paths, str):
        zip_paths = [zip_paths]
    zips = [zipfile.ZipFile(p) for p in zip_paths]
    def rows(z_unused, name): return _rows(zips, name)
    z = None  # rows() ignores its first arg; multiple months merged, latest version wins

    # latest noticeVersion per noticeIdentifier
    notice = {}
    for r in rows(z, "notice.csv"):
        nid, ver = r["noticeIdentifier"], r["noticeVersion"]
        try: vnum = int(ver)
        except: vnum = -1
        if nid not in notice or vnum > notice[nid][0]:
            notice[nid] = (vnum, ver, r["formType"], r["publicationDate"])
    chosen = {nid: v[1] for nid, v in notice.items()}
    def keep(nid, ver): return chosen.get(nid) == ver

    title_notice, titles_all, descs, natures = {}, defaultdict(list), defaultdict(list), defaultdict(set)
    for r in rows(z, "purpose.csv"):
        nid, ver = r["noticeIdentifier"], r["noticeVersion"]
        if not keep(nid, ver): continue
        if r["title"]:
            titles_all[nid].append(r["title"])
            if r["lotIdentifier"] == "" and nid not in title_notice:
                title_notice[nid] = r["title"]
        if r["description"]: descs[nid].append(r["description"])
        if r["mainNature"]: natures[nid].add(r["mainNature"])

    buyer = {}
    for r in rows(z, "organisation.csv"):
        nid, ver = r["noticeIdentifier"], r["noticeVersion"]
        if not keep(nid, ver): continue
        if r["organisationRole"] == "buyer" and r["organisationName"] and nid not in buyer:
            buyer[nid] = r["organisationName"]

    cpv_all, cpv_main = defaultdict(set), defaultdict(set)
    for r in rows(z, "classification.csv"):
        nid, ver = r["noticeIdentifier"], r["noticeVersion"]
        if not keep(nid, ver): continue
        if r["classificationType"] != "cpv": continue
        m = (r["mainClassificationCode"] or "").strip()
        if m:
            cpv_main[nid].add(m); cpv_all[nid].add(m)
        for c in (r["additionalClassificationCodes"] or "").replace(";", ",").split(","):
            c = c.strip()
            if c: cpv_all[nid].add(c)

    nuts = defaultdict(set)
    for r in rows(z, "placeOfPerformance.csv"):
        nid, ver = r["noticeIdentifier"], r["noticeVersion"]
        if not keep(nid, ver): continue
        v = r["placePerformanceCountrySubdivision"].strip()
        if v: nuts[nid].add(v)

    def build(nid, pub, hh_reason):
        return {
            "nid": nid,
            "title": title_notice.get(nid) or (titles_all[nid][0] if titles_all.get(nid) else ""),
            "buyer": buyer.get(nid, ""),
            "cpv": sorted(cpv_all.get(nid, set())),
            "cpv_main": sorted(cpv_main.get(nid, set())),
            "nuts": sorted(nuts.get(nid, set())),
            "natures": sorted(natures.get(nid, set())),
            "title_text": " ".join(titles_all.get(nid, [])).lower(),
            "desc_text": " ".join(descs.get(nid, [])).lower(),
            "pub": pub, "hh_reason": hh_reason,
        }

    # Hamburg is a city-state: NUTS DE6 (Land) / DE60 / DE600 all mean Hamburg, and no
    # other DE6* code exists -> matching the prefix "DE6" is the correct, recall-safe test.
    def is_hh_nuts(nset): return any(n.startswith("DE6") for n in nset)

    total_competition = 0
    hamburg, near_miss = [], []   # near_miss = HH-buyer but Leistungsort != Hamburg (excluded by strict rule)
    for nid, (vnum, ver, ft, pub) in notice.items():
        if ft != "competition": continue
        total_competition += 1
        nset = nuts.get(nid, set())
        b = buyer.get(nid, "")
        if is_hh_nuts(nset):
            hh = sorted(n for n in nset if n.startswith("DE6"))
            hamburg.append(build(nid, pub, "NUTS " + ",".join(hh)))
        elif len(nset) == 0 and "hamburg" in b.lower():
            hamburg.append(build(nid, pub, "buyer-name (kein Leistungsort gesetzt)"))
        elif "hamburg" in b.lower():
            # HH-Auftraggeber, aber Leistungsort ausserhalb -> Recall-Risiko, separat sammeln
            near_miss.append(build(nid, pub, f"HH-Auftraggeber, Leistungsort={sorted(nset)}"))

    return {"notice": notice, "total_competition": total_competition,
            "hamburg": hamburg, "near_miss": near_miss}
