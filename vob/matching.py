#!/usr/bin/env python3
"""Matching: CPV-prefix (main-vs-additional weighted) + title keywords + judgement corrections."""
RANK = {"mittel": 1, "hoch": 2, "sehr hoch": 3}
ORD = ["mittel", "hoch", "sehr hoch"]

def cap(rel, ceiling): return rel if RANK[rel] <= RANK[ceiling] else ceiling
def down(rel, n=1): return ORD[max(0, RANK[rel] - 1 - n)]   # n=1 -> one notch, n=2 -> two notches

def _hp(cpvs, prefixes): return any(c.startswith(p) for c in cpvs for p in prefixes)

def match_tender(t):
    cpvs = t["cpv"]
    mains = t.get("cpv_main", [])
    tt = t["title_text"] + " " + t["title"].lower()
    natset = set(t["natures"])
    is_works = "works" in natset
    is_supplies = "supplies" in natset and not is_works
    metal = any(k in tt for k in ["metallbau", "rohrrahmen", "schlosser"])
    metal_fassade = any(k in tt for k in ["pfosten-riegel", "pfosten/riegel", "elementfassade"]) or metal
    firms = {}

    def add(firm, rel, reason):
        if firm not in firms or RANK[rel] > RANK[firms[firm]["rel"]]:
            firms[firm] = {"rel": rel, "reason": reason}

    def addcpv(firm, base_rel, prefixes, reason):
        """Add from a CPV rule, weighting main vs additional-only codes."""
        if not _hp(cpvs, prefixes): return
        if _hp(mains, prefixes):
            add(firm, base_rel, reason)                      # primary scope of some lot
        elif len(cpvs) >= 6:
            add(firm, down(base_rel, 2), reason + " | CPV nur Neben-Code in grossem Mischauftrag -> abgewertet")
        else:
            add(firm, down(base_rel, 1), reason + " | CPV nur Neben-Code -> abgewertet")

    # ---- CPV-Prefix rules ----
    if _hp(cpvs, ["45442"]):
        addcpv("maler-hantke", "sehr hoch", ["45442"], "CPV 45442 (Anstrich-/Malerarbeiten)")
    elif _hp(cpvs, ["45440", "45441"]):
        addcpv("maler-hantke", "hoch", ["45440", "45441"], "CPV 4544x (Anstrich-/Malerarbeiten)")
    if _hp(cpvs, ["45443"]):
        addcpv("werner-bau", "sehr hoch", ["45443"], "CPV 45443 (Fassadenarbeiten)")
        addcpv("werner-geruestbau", "hoch", ["45443"], "CPV 45443 (Fassade -> Geruestbedarf)")
    if _hp(cpvs, ["45320", "45321"]):
        addcpv("werner-bau", "sehr hoch", ["45320", "45321"], "CPV 4532x (Daemmung/Abdichtung)")
    if _hp(cpvs, ["45410"]):
        addcpv("werner-bau", "hoch", ["45410"], "CPV 45410 (Putzarbeiten)")
    if _hp(cpvs, ["452621"]):
        addcpv("werner-geruestbau", "sehr hoch", ["452621"], "CPV 452621x (Geruestarbeiten)")
    if _hp(cpvs, ["44221"]):
        addcpv("seehafer-elemente", "hoch", ["44221"], "CPV 44221 (Fenster/Tueren/Bauelemente)")
    if _hp(cpvs, ["45421"]) and not _hp(cpvs, ["4542114"]):
        addcpv("seehafer-elemente", "hoch", ["45421"], "CPV 45421 (Bautischlerei/Montage)")
        addcpv("tischlerei-brink", "mittel", ["45421"], "CPV 45421 (Bautischlerei)")
    if _hp(cpvs, ["45450"]):
        addcpv("mehlig", "hoch", ["45450"], "CPV 45450 (sonstiger Innenausbau)")
    if _hp(cpvs, ["45420"]) and not _hp(cpvs, ["45421"]):
        addcpv("tischlerei-brink", "hoch", ["45420"], "CPV 45420 (Bautischler/Innenausbau)")
        addcpv("mehlig", "hoch", ["45420"], "CPV 45420 (Innenausbau)")

    # ---- Title keywords ----
    if "tischler" in tt and "zimmer" not in tt:
        add("seehafer-elemente", "hoch", "Titel: Tischler (Neubau/Montage)")
        add("tischlerei-brink", "mittel", "Titel: Tischler (Reparatur/Wartung)")
    if any(k in tt for k in ["einbaukueche", "einbauküche", "feste einbauten", "innenausbau"]):
        add("mehlig", "hoch", "Titel: Einbaukueche/feste Einbauten/Innenausbau")
    if "möbel" in tt and not any(k in tt for k in ["einbauküche", "feste einbauten", "innenausbau"]):
        if is_works: add("mehlig", "hoch", "Titel: Moebel (Bauleistung)")
        elif is_supplies: add("mehlig", "mittel", "Titel: Moebel (reine Beschaffung/Lieferung)")
        else: add("mehlig", "hoch", "Titel: Moebel")
    if ("fenster" in tt or "türen" in tt) and not metal:
        add("seehafer-elemente", "sehr hoch", "Titel: Fenster/Tueren (Holz/Bauelemente)")
        add("tischlerei-brink", "mittel", "Titel: Fenster/Tueren")
    if any(k in tt for k in ["maler", "anstrich", "lackier", "korrosionsschutz"]):
        if "korrosionsschutz" in tt: add("maler-hantke", "mittel", "Titel: Korrosionsschutz (i.d.R. Teilleistung)")
        else: add("maler-hantke", "hoch", "Titel: Maler/Anstrich/Lackierung")
    if "fassade" in tt and not metal and "glas" not in tt:
        add("werner-bau", "hoch", "Titel: Fassade")
        add("werner-geruestbau", "hoch", "Titel: Fassade (Geruestbedarf)")
    if "putz" in tt: add("werner-bau", "hoch", "Titel: Putzarbeiten")
    if any(k in tt for k in ["dämmung", "wdvs", "wärmedämm"]):
        add("werner-bau", "sehr hoch", "Titel: Daemmung/WDVS/Waermedaemmung")
    if "gerüst" in tt and not _hp(cpvs, ["452621"]):
        add("werner-geruestbau", "hoch", "Titel: Geruest")

    # ---- PLANUNG -> BSI ----
    plan_kw = ["objektplanung", "projektsteuerung", "bauleitung", "bauüberwachung",
               "brandschutzkonzept", "generalplan", "bauablauf"]
    hochbau = ["gebäude", "schule", "sanierung", "umbau", "neubau", "klinik", "haus",
               "sporthalle", "kita", "pastorat", "rathaus", "architekt"]
    plan_excl = ["verkehrsanlage", "tunnel", "brücke", "bahn", "freianlage",
                 "technische ausrüstung", "tga", "ingenieurbauwerk", "u-bahn",
                 "stützwand", "deich", "polder"]
    if any(k in tt for k in plan_kw) and any(k in tt for k in hochbau) and not any(k in tt for k in plan_excl):
        rel = "mittel" if "brandschutzkonzept" in tt else "hoch"
        add("bsi", rel, "Titel: Planungs-/Steuerungsleistung mit Hochbaubezug")

    # ---- Urteils-Korrekturen ----
    # Beschichtung/Korrosionsschutz als Teil eines Infrastruktur-Grossprojekts -> nur mittel
    infra = (any(k in tt for k in ["tunnel", "verkehrsanlage", "mast", "brücke", "autobahn", "u-bahn"])
             or "verkehr" in t["buyer"].lower())
    if "maler-hantke" in firms and infra and not any(k in tt for k in ["maler", "anstrich", "lackier"]):
        firms["maler-hantke"]["rel"] = cap(firms["maler-hantke"]["rel"], "mittel")
        firms["maler-hantke"]["reason"] += " | Beschichtung im Infrastruktur-Grossprojekt -> abgewertet"
    if metal and "seehafer-elemente" in firms:
        firms["seehafer-elemente"]["rel"] = cap(firms["seehafer-elemente"]["rel"], "mittel")
        firms["seehafer-elemente"]["reason"] += " | Metallausfuehrung -> abgewertet"
    if metal_fassade and "werner-bau" in firms and "putz" not in tt and not any(k in tt for k in ["wdvs", "dämmung", "wärmedämm"]):
        firms["werner-bau"]["rel"] = cap(firms["werner-bau"]["rel"], "mittel")
        firms["werner-bau"]["reason"] += " | Metall-/Elementfassade -> abgewertet"
    bundesweit = any(k in tt or k in t["desc_text"] for k in ["bundesweit", "deutschlandweit"])
    if bundesweit:
        for f in firms:
            firms[f]["rel"] = cap(firms[f]["rel"], "hoch")
            firms[f]["reason"] += " | bundesweiter Rahmen -> gekappt"

    return firms
