# VOB OCDS Hamburg — täglicher Ausschreibungs-Scan

Zieht jeden Tag die laufenden öffentlichen Ausschreibungen für **Hamburg** aus der
offiziellen Open-Data-API (`oeffentlichevergabe.de`), matcht sie auf die
Gruppenwerk-Gewerke und legt das Ergebnis als Google Sheet ab.

## Schnellstart

```bash
cd vob
python3 run_daily.py            # schreibt vob_out/final.csv + vob_out/summary.json
```

Laufzeit ~15 s. Keine externen Abhängigkeiten außer `requests`.

## Pipeline (zustandslos)

1. **Fetch** — rollierendes 2-Monats-Fenster (aktueller + Vormonat) als CSV-ZIP.
   Das Fenster verhindert, dass Tender fehlen, die letzten Monat veröffentlicht
   wurden, aber noch laufen.
2. **Filter** (`vobcore.py`) — `formType == competition` **und** Hamburg.
   Hamburg = Leistungsort-NUTS beginnt mit `DE6` (Stadtstaat: `DE6`/`DE60`/`DE600`),
   ersatzweise „hamburg" im Auftraggeber, wenn kein Leistungsort gesetzt ist.
3. **Match** (`matching.py`) — CPV-Prefix (haupt-/neben-code-gewichtet) + Titel-
   Keywords + Urteils-Korrekturen (Metall-/Elementfassade, Infrastruktur-
   Beschichtung, bundesweite Rahmen, harte Gewerk-Ausschlüsse).
4. **Frist** (`enrich.py`) — echte Frist je Treffer aus der Notice-XML
   (`TenderSubmissionDeadlinePeriod` / `ParticipationRequestReceptionPeriod`),
   12 parallel, mit Retry. Zeitzonen-genau gegen *jetzt*; Abgelaufene raus.
5. **Build** (`build.py`) — CSV; `Neu`-Spalte (🆕 = in den letzten 2 Tagen
   veröffentlicht), sortiert nach Frist.

Spalten: `Neu, Titel, Auftraggeber, CPV, Kategorie, Frist, Match-Firmen, Relevanz, Begründung, URL`

## Qualitätskontrolle

```bash
python3 recall.py    # listet HH-Tender mit Bau-Signal, die NICHT gematcht wurden
```
Dient der Recall-Prüfung (übersehene Treffer) und der Filter-Validierung.

## Täglicher Lauf

Wird über einen Claude-Code-Trigger (Routine) gefahren, der `run_daily.py`
ausführt und aus `vob_out/final.csv` ein Google Sheet erzeugt. Stateless —
jeder Lauf ist eigenständig, kein Scheduling-/State-File nötig.

## Bekannte offene Punkte

- Matching auf Notice-Ebene aggregiert (nicht Los-Ebene): bei Mehr-Los-Notices
  kann der angezeigte Titel vom matchenden Los abweichen.
- `bsi` (Planung) ist titel-keyword-basiert; 71xx-Planungsleistungen ohne
  Schlüsselwort im Titel können durchrutschen.
