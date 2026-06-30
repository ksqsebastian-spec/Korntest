# VOB OCDS Hamburg → Supabase

Täglicher, stiller Scan der laufenden öffentlichen Ausschreibungen für **Hamburg**
aus der offiziellen Open-Data-API (`oeffentlichevergabe.de`, OCDS-Export), Matching
auf die Gruppenwerk-Firmen, Ablage in **Supabase Schema `vob`**.
Kein Firecrawl, keine Google Sheets. Läuft autonom; nur bei Fehlern wird gemeldet.

## Schnellstart

```bash
cd vob
# 1) bekannte URLs für Dedup ziehen (aus Supabase) -> seen.txt
# 2) Scan + atomares SQL erzeugen:
python3 vob_supabase.py --seen seen.txt --out scan.sql
# 3) scan.sql per Supabase-Connector (execute_sql) ausführen
```

Laufzeit ~15 s. Einzige Abhängigkeit: `requests`.

## Pipeline (zustandslos)

1. **Fetch** (`vobcore.py`) — rollierendes 2-Monats-Fenster (aktueller + Vormonat)
   als CSV-ZIP, damit letzten Monat veröffentlichte, noch laufende Tender nicht fehlen.
2. **Filter** — `formType == competition` **und** Hamburg (Leistungsort-NUTS beginnt
   mit `DE6`; ersatzweise „hamburg" im Auftraggeber, wenn kein Leistungsort gesetzt).
3. **Dedup** — URLs, die schon in `vob.vob_tenders` stehen, werden vor dem Matching entfernt.
4. **Match** (`matching_db.py`) — Titel + CPV gegen die aktiven `vob.companies`
   (malerei-hantke, seehafer-elemente, gruppenwerk) und deren `keywords`.
   relevance: `sehr hoch` / `hoch` / `mittel`. Urteils-Korrekturen: Metall-/
   Elementfassade, Infrastruktur-Beschichtung, bundesweite Rahmen.
5. **Frist** (`enrich.py`) — echte Frist je Treffer aus der Notice-XML
   (parallel + Retry), zeitzonen-genau; Abgelaufene raus.
6. **Write** (`vob_supabase.py`) — EIN atomares CTE:
   `vob_scans` (weekly upsert auf `(calendar_week, year)`) → `vob_tenders`
   (status `active`, scan_id) → `vob_matches` (company_id per slug-Join).
   `urgency` wird NICHT geschrieben — die View `vob.vob_dashboard` berechnet sie aus
   `deadline_date`.

## Qualitätskontrolle

```bash
python3 recall.py    # HH-Tender mit Bau-Signal, die NICHT matchen (Recall/Precision-Check)
```

## Niemals

`public`-Schema (totes Alt-Zeug), Firecrawl, Google Sheets, leere Daten bei
Total-Ausfall schreiben, Repo/Vercel ändern.
