# VOB-Scan Gruppenwerk — Skill (OCDS → Supabase)

> Trigger-Prompt, der den alten Firecrawl-Skill ersetzt. Autonom & still.

```
VOB-Scan für Gruppenwerk. Läuft autonom und still. KEINE Erfolgs-Zusammenfassung;
nur bei Fehlern kurz melden.

QUELLE: OCDS-Open-Data (oeffentlichevergabe.de) — KEIN Firecrawl, KEINE Google Sheets.
SUPABASE: Projekt ldmprzkregyicxgdbfsa, Schema vob (NIEMALS public – totes Alt-Zeug).
Supabase per Connector. Das Toolkit liegt im Repo unter vob/.

1) DEDUP-URLs laden (SQL, gratis):
   select url from vob.vob_tenders;
   -> nach vob/seen.txt schreiben (eine URL pro Zeile).

2) SCAN erzeugen (im Repo):
   git pull origin claude/vob-ocds-hamburg-test-sz60ba
   cd vob && python3 vob_supabase.py --seen seen.txt --out scan.sql
   Das Skript (zustandslos, ~15 s): lädt rollierendes 2-Monats-OCDS-Fenster,
   filtert Hamburg (Leistungsort-NUTS beginnt mit DE6), entfernt bekannte URLs,
   matcht Titel+CPV gegen vob.companies.keywords (malerei-hantke, seehafer-elemente,
   gruppenwerk), holt echte Fristen aus der Notice-XML, wirft Abgelaufene raus,
   schreibt EIN atomares CTE nach scan.sql. Gibt Stats als JSON aus.

3) SCHREIBEN: Inhalt von scan.sql per Supabase execute_sql ausführen. Das CTE:
   vob_scans  (weekly upsert auf (calendar_week, year): scan_date, total_listings,
              matched_count, new_listings)
   vob_tenders (title, authority, deadline [roh], deadline_date, category, url,
              status 'active', scan_id)
   vob_matches (tender_id, company_id [per slug-Join auf vob.companies], company_slug,
              relevance, reason)
   urgency wird NICHT geschrieben — die View vob.vob_dashboard berechnet sie aus deadline_date.

GUARDRAILS: Bei Download- oder Schreib-Totalausfall abbrechen, KEINE leeren Daten schreiben.
NICHT: public-Schema, Firecrawl, Google Sheets/DOCX/Mail/Storage, Repo/Vercel ändern.
```

## Was sich ggü. dem alten Skill ändert
- Datenquelle **Firecrawl-map/scrape von hamburg.de → OCDS-Open-Data-Export**
  (vollständig, gratis, kein Credit-Verbrauch, kein JS-lazy-Listing-Problem).
- Matching nicht mehr nur auf Listing-Titel, sondern **Titel + CPV-Codes** → höhere
  Trefferquote und weniger False Positives.
- Echte **Fristen aus der Notice-XML** statt nur deadline_text vom Listing.
- Hamburg-Filter über **NUTS DE6** statt Listing-Quelle → fängt auch Tender bundesweiter
  Auftraggeber mit Leistungsort Hamburg.
- Schreiben & Schema-Ziel (vob_scans/vob_tenders/vob_matches, urgency via View) **unverändert**.
```
