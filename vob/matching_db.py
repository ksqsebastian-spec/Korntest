#!/usr/bin/env python3
"""Match OCDS tenders against the 3 active vob.companies (keyword + CPV based).
Slugs: malerei-hantke, seehafer-elemente, gruppenwerk."""
RANK = {"mittel": 1, "hoch": 2, "sehr hoch": 3}
ORD = ["mittel", "hoch", "sehr hoch"]
def cap(rel, ceiling): return rel if RANK[rel] <= RANK[ceiling] else ceiling

def _hp(cpvs, *pfx): return any(c.startswith(p) for c in cpvs for p in pfx)

def match_companies(t):
    """Returns {slug: {"rel":, "reason":}} for the 3 companies."""
    cpvs = t["cpv"]
    tt = (t["title_text"] + " " + t["title"].lower())
    metal_fassade = any(k in tt for k in ["pfosten-riegel", "elementfassade", "vorhangfassade", "metallbau", "glasfassade"])
    out = {}
    def add(slug, rel, reason):
        if slug not in out or RANK[rel] > RANK[out[slug]["rel"]]:
            out[slug] = {"rel": rel, "reason": reason}

    # ---------- malerei-hantke (Maler/Putz/WDVS/Fassade/Beschichtung) ----------
    if any(k in tt for k in ["maler", "anstrich", "lackier"]):
        add("malerei-hantke", "sehr hoch", "Titel: Maler/Anstrich/Lackierung")
    if any(k in tt for k in ["wdvs", "wärmedämm", "dämmung"]):
        add("malerei-hantke", "sehr hoch", "Titel: WDVS/Wärmedämmung")
    if "putz" in tt:
        add("malerei-hantke", "hoch", "Titel: Putzarbeiten")
    if "tapezier" in tt:
        add("malerei-hantke", "hoch", "Titel: Tapezierarbeiten")
    if "korrosionsschutz" in tt:
        add("malerei-hantke", "mittel", "Titel: Korrosionsschutz (i.d.R. Teilleistung)")
    if "fassade" in tt and not metal_fassade:
        add("malerei-hantke", "hoch", "Titel: Fassade (Putz/WDVS)")
    if _hp(cpvs, "45442"):
        add("malerei-hantke", "sehr hoch", "CPV 45442 (Anstrich-/Malerarbeiten)")
    if _hp(cpvs, "45440", "45441"):
        add("malerei-hantke", "hoch", "CPV 4544x (Anstricharbeiten)")
    if _hp(cpvs, "45410"):
        add("malerei-hantke", "hoch", "CPV 45410 (Putzarbeiten)")
    if _hp(cpvs, "45320", "45321"):
        add("malerei-hantke", "hoch", "CPV 4532x (Dämmung/Abdichtung)")
    if _hp(cpvs, "45443") and not metal_fassade:
        add("malerei-hantke", "hoch", "CPV 45443 (Fassadenarbeiten)")

    # ---------- seehafer-elemente (Tischler/Fenster/Holz/Glas/Metallbau) ----------
    if "tischler" in tt and "zimmer" not in tt:
        add("seehafer-elemente", "sehr hoch", "Titel: Tischler")
    if "fenster" in tt or "türen" in tt or "innentüren" in tt:
        add("seehafer-elemente", "sehr hoch", "Titel: Fenster/Türen")
    if any(k in tt for k in ["holzbau verglas", "verglasung", " glas", "glasfassade"]):
        add("seehafer-elemente", "hoch", "Titel: Glas/Verglasung")
    if "metallbau" in tt:
        add("seehafer-elemente", "hoch", "Titel: Metallbau (Elemente)")
    if any(k in tt for k in ["einbauküche", "feste einbauten", "innenausbau", "möbel"]):
        add("seehafer-elemente", "hoch", "Titel: Möbel/Einbauten/Innenausbau")
    if metal_fassade:
        add("seehafer-elemente", "hoch", "Titel: Element-/Metall-/Glasfassade")
    if _hp(cpvs, "45421") and not _hp(cpvs, "4542114"):
        add("seehafer-elemente", "hoch", "CPV 45421 (Bautischlerei/Montage)")
    if _hp(cpvs, "45420") and not _hp(cpvs, "45421"):
        add("seehafer-elemente", "hoch", "CPV 45420 (Bautischler/Innenausbau)")
    if _hp(cpvs, "44221"):
        add("seehafer-elemente", "hoch", "CPV 44221 (Fenster/Türen/Bauelemente)")
    if _hp(cpvs, "45443") and metal_fassade:
        add("seehafer-elemente", "hoch", "CPV 45443 (Element-/Metallfassade)")

    # ---------- gruppenwerk (GU/Totalunternehmer/Rohbau) ----------
    if any(k in tt for k in ["generalunternehmer", "generalübernehmer", "totalunternehmer", "gu-leistung", "gü-leistung"]):
        add("gruppenwerk", "sehr hoch", "Titel: General-/Totalunternehmerleistung")
    if "rohbau" in tt:
        add("gruppenwerk", "hoch", "Titel: Rohbau")
    if _hp(cpvs, "45223220", "45262522", "45262500"):
        add("gruppenwerk", "hoch", "CPV Rohbau")

    # ---------- Urteils-Korrekturen ----------
    infra = (any(k in tt for k in ["tunnel", "verkehrsanlage", "mast", "brücke", "autobahn", "u-bahn"])
             or "verkehr" in t["buyer"].lower())
    if "malerei-hantke" in out and infra and not any(k in tt for k in ["maler", "anstrich", "lackier"]):
        out["malerei-hantke"]["rel"] = cap(out["malerei-hantke"]["rel"], "mittel")
        out["malerei-hantke"]["reason"] += " | Beschichtung im Infrastrukturprojekt -> abgewertet"
    bundesweit = any(k in tt or k in t["desc_text"] for k in ["bundesweit", "deutschlandweit"])
    if bundesweit:
        for s in out:
            out[s]["rel"] = cap(out[s]["rel"], "hoch")
            out[s]["reason"] += " | bundesweiter Rahmen -> gekappt"
    return out
