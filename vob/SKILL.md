# VOB-Scan Gruppenwerk — Skill (OCDS → Supabase)

> Trigger-Prompt, der den alten Firecrawl-Skill ersetzt. Autonom & still.

```
VOB-Scan für Gruppenwerk. Läuft autonom und still. NUR bei Fehlern kurz melden.

QUELLE: OCDS-Open-Data (oeffentlichevergabe.de) — KEIN Firecrawl, KEINE Google Sheets.
SUPABASE: Projekt ldmprzkregyicxgdbfsa, Schema vob (NIEMALS public – totes Alt-Zeug).
Supabase + Bash per Connector.

1) CODE + DEPS bereitstellen (frischer Remote-Clone checkt den Default-Branch aus,
   das Toolkit liegt aber auf claude/vob-ocds-hamburg-test-sz60ba):
   cd /home/user/Korntest
   git fetch origin claude/vob-ocds-hamburg-test-sz60ba
   git checkout -B vob-run origin/claude/vob-ocds-hamburg-test-sz60ba
   pip install -q requests 2>/dev/null || pip install -q --user requests
   (Netzfehler: bis 4x mit Backoff. Schlägt der Checkout fehl -> melden + abbrechen.)

2) DEDUP-URLs aus Supabase laden:
   select url from vob.vob_tenders;
   -> nach vob/seen.txt schreiben (eine URL pro Zeile).

3) SCAN erzeugen:
   cd vob && python3 vob_supabase.py --seen seen.txt --out scan.sql
   Das Skript (zustandslos, ~15 s): rollierendes 2-Monats-OCDS-Fenster, Hamburg-Filter
   (Leistungsort-NUTS beginnt mit DE6), Dedup, Match Titel+CPV gegen vob.companies.keywords
   (malerei-hantke, seehafer-elemente, gruppenwerk), echte Fristen aus der Notice-XML,
   Abgelaufene raus, EIN atomares CTE nach scan.sql + Stats-JSON auf stdout.
   Exit≠0 oder leeres scan.sql trotz Listings -> melden + abbrechen, NICHT leer schreiben.

4) SCHREIBEN: Inhalt von vob/scan.sql per Supabase execute_sql (Projekt ldmprzkregyicxgdbfsa)
   ausführen. CTE: vob_scans (weekly upsert auf (calendar_week, year)) ->
   vob_tenders (status 'active', scan_id) -> vob_matches (company_id per slug-Join).
   urgency NICHT schreiben — die View vob.vob_dashboard berechnet sie aus deadline_date.

5) Erfolg: keine Ausgabe. Fehler: kurz melden.
GUARDRAILS: Bei Download-/Schreib-Totalausfall abbrechen, KEINE leeren Daten schreiben.
NICHT: public-Schema, Firecrawl, Google Sheets/DOCX/Mail/Storage, Repo/Vercel ändern.
```

> **Branch-Hinweis:** Solange `vob/` nur auf `claude/vob-ocds-hamburg-test-sz60ba` liegt,
> hängt die Routine an diesem Branch. Wird er gelöscht (z. B. nach PR-Merge), bricht der
> Lauf. Für dauerhaften Betrieb gehört `vob/` auf den **Default-Branch** — dann genügt im
> Prompt ein simples `git pull` ohne expliziten Checkout.

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
