#!/usr/bin/env python3
"""Recall test: surface Hamburg tenders with construction/planning signal that did NOT match,
plus HH-buyer tenders excluded by the strict Leistungsort rule."""
import sys
from vobcore import load
from matching import match_tender

data = load()
ham = data["hamburg"]

CONSTR_KW = ["bau", "sanierung", "neubau", "umbau", "dach", "fenster", "tür", "fassade",
             "putz", "estrich", "fliesen", "maler", "tischler", "gerüst", "abdichtung",
             "dämmung", "fußboden", "trockenbau", "rohbau", "ausbau", "instandsetzung",
             "renovierung", "planung", "architekt", "hoai", "gebäude", "schule", "halle"]

def signal(t):
    sig = []
    for c in t["cpv"]:
        if c[:2] in ("45", "71", "44"):
            sig.append("CPV" + c[:2]); break
    kw = [k for k in CONSTR_KW if k in (t["title_text"] + " " + t["title"].lower())]
    if kw: sig.append("kw:" + ",".join(kw[:4]))
    return sig

matched, unmatched_signal = 0, []
for t in ham:
    if match_tender(t):
        matched += 1
    else:
        s = signal(t)
        if s:
            unmatched_signal.append((t, s))

print(f"Hamburg competition: {len(ham)} | matched: {matched} | unmatched-with-signal: {len(unmatched_signal)}")
print("\n===== UNMATCHED aber Bau-/Planungs-Signal (Recall-Pruefung) =====")
for t, s in sorted(unmatched_signal, key=lambda x: x[0]["title"].lower()):
    print(f"\n• {t['title'][:90]}")
    print(f"  Buyer: {t['buyer'][:70]}")
    print(f"  CPV: {', '.join(t['cpv'][:10])}")
    print(f"  Natures: {t['natures']} | Signal: {s}")

print(f"\n===== NEAR-MISS: HH-Auftraggeber, Leistungsort ausserhalb ({len(data['near_miss'])}) =====")
for t in data["near_miss"]:
    if signal(t):
        print(f"• {t['title'][:80]} | {t['hh_reason']} | CPV {', '.join(t['cpv'][:5])}")
