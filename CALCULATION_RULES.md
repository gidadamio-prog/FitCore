# Berechnungsregeln

Implementierung: `src/domain/*.ts` · Tests: `tests/domain/*.test.ts`. Alle Werte sind Schätzungen.

## Energiebedarf
- **Mifflin-St Jeor:** BMR = 10·kg + 6,25·cm − 5·Jahre **+ 5** (männlich) bzw. **− 161** (weiblich). Referenz: 80 kg/180 cm/30 J./+5 → 1780 kcal.
- **Katch-McArdle** (optional, nur mit KF%): 370 + 21,6 · fettfreie Masse.
- **TDEE** = BMR × Aktivitätsfaktor: 1,2 / 1,375 / 1,55 / 1,725 / 1,9.
- **Zielkalorien:** Anpassung = Rate (kg/Woche) × 7700 kcal / 7. Standardraten: Abnehmen/Fett reduzieren −0,5 % KG/Woche, Rekomposition −0,15 %, Muskelaufbau +0,25 %, Kraft +0,1 %, sonst 0.
- **Sicherheitsgrenzen:** Defizit ≤ 25 % TDEE und ≤ 1000 kcal; Ziel ≥ max(1500 ♂ / 1200 ♀, 0,9 × BMR); Überschuss ≤ 500 kcal; Rate |≤ 1,5| kg/Woche. Bei Schwangerschaft, Stillzeit oder medizinischen Gründen: **kein automatisches Defizit** + Hinweis. Automatische Berechnungen nur ab 18 Jahren.
- Ergebnis wird gerundet; Formel, BMR, TDEE, Anpassung und Ziel werden angezeigt.

## Makronährstoffe
- Protein g/kg: Abnehmen/Fett/Rekomposition 2,0; Aufbau/Kraft 1,8; sonst 1,6; Strategie „proteinbetont“ +0,3.
- Fett: Anteil 30 % (ausgewogen) / 40 % (weniger KH) / 20 % (mehr KH) / 28 % (proteinbetont), mindestens 0,6 g/kg.
- Kohlenhydrate = Rest (nie negativ; sonst Fett auf Minimum + Warnung).
- Konsistenz: 4·P + 4·KH + 9·F vs. Kalorienziel; Toleranz ±25 kcal, Abweichung wird angezeigt.

## Nährwerte
- Skalierung: Wert = Wert/100 × Gramm; Rundung kcal ganzzahlig, Salz 0,01 g, sonst 0,1 g. Unbekannt bleibt unbekannt.
- Summen zählen unbekannte Werte separat (Hinweis „Mindestwerte“).
- kJ → kcal: ÷ 4,184. Natrium → Salz: × 2,5. mg/µg → g.
- **Etikett vs. Makros:** Gebucht wird der Etikettwert. Weicht Atwater (4/4/9, ohne Ballaststoffe/Alkohol) um > 15 % und > 10 kcal ab, erscheint ein Hinweis. Fehlen kcal auf dem Etikett, werden sie **nicht** aus Makros ergänzt.
- Rezepte: Summe der Zutaten; pro Portion = Gesamt / Portionen; pro 100 g = Gesamt / Gesamtgewicht. Unvollständige Zutaten werden benannt.

## Körper
- **US-Navy (Hodgdon & Beckett, Zoll):** ♂ 86,010·log10(Bauch − Hals) − 70,041·log10(Größe) + 36,76; ♀ 163,205·log10(Taille + Hüfte − Hals) − 97,684·log10(Größe) − 78,387. Eingaben cm → ÷ 2,54. Plausibilitätsbereich Ergebnis 2–65 %. Referenztests gegen separat (Python) berechnete Werte und Gegenprüfung mit der metrischen SI-Variante (±0,5 PP).
- Fettmasse = Gewicht × KF%; fettfreie Masse = Gewicht − Fettmasse.
- **Gewichtstrend:** Tagesmittel mehrerer Messungen; zeitgewichteter EMA α = 0,1/Tag (α_eff = 1 − 0,9^Δ Tage); keine Werte für fehlende Tage. 7-Tage-Mittel (Kalenderfenster). 7/14/30-Tage-Trend = lineare Regression in kg/Woche.
- **Zielprognose:** nur ≥ 7 Messungen über ≥ 14 Tage; ETA = (Ziel − Trend) / Steigung; Bereich aus Steigung ± 1,96 · Standardfehler.

## Training
- Volumen = Σ Gewicht × Wdh. abgeschlossener Sätze (Körpergewicht ohne Zusatzlast = 0). 3×10×60 = 1800 kg.
- Sätze pro Muskelgruppe: primär 1, sekundär 0,5.
- e1RM (Epley) = w·(1 + r/30), r = 1 → w; nur r ≤ 12.
- Rekorde: höchstes Gewicht, e1RM, meiste Wdh., Volumen/Einheit; zusätzlich Wiederholungsbestleistung je Gewicht.
- Progression (doppelte Progression): alle Sätze ≥ Wdh.-Max → +2,5 kg; zwei Einheiten mit Sätzen < Wdh.-Min → −10 %; sonst halten.
- **Energie (Netto-MET):** (MET − 1) × kg × h. Kraft MET 5; Laufen ≈ km/h (6–16); Gehen 2,8–5; Rad 4–12 nach Tempo; Schwimmen/Rudern 7; Crosstrainer 5; eigene Sportart 2 + 0,7·RPE. Ohne erfasstes Körpergewicht: 0 kcal + Hinweis.

## Kalorienziel je Mahlzeit
- Tagesbudget = Kalorienziel der Zielversion + angerechnete Trainings-kcal (wie Energiebilanz).
- Aufteilung in % je Mahlzeit (Standard Frühstück 25 / Mittag 35 / Abend 30 / Snacks 10, eigene Mahlzeiten 0). Anteile werden auf ihre Summe normiert (Summe 0 → gleichmäßig).
- Ganzzahlige Verteilung nach der Methode der größten Reste: Die Mahlzeitziele ergeben immer exakt das Tagesbudget.
- Anpassung im Tagesverlauf: Mahlzeiten mit Einträgen gelten als gegessen. Rest = Tagesbudget − gegessene kcal dieser Mahlzeiten (nie < 0) wird auf die offenen Mahlzeiten im Verhältnis ihrer Anteile verteilt (alle offenen 0 % → gleichmäßig).

## Energiebilanz
- anrechenbar = max(0, Σ Trainings-kcal − bereits enthaltene kcal (falls „Training im Aktivitätsfaktor“)); angerechnet = anrechenbar × Quote.
- **Verbleibend = Ziel + angerechnet − gegessen** (2000 + 300 − 1500 = 800).
- Trainings werden per ID dedupliziert; Workout-Abschluss ist idempotent; Ausdauer-Duplikat = gleiche Sportart, Start ±5 min, gleiche Dauer.

## Statistik & Coach
- Fehlende Tage = Lücke (null). Zielerreichung = Tage mit |kcal − Ziel| ≤ 10 % / auswertbare Tage; Lücken werden ausgewiesen. Protein erreicht = ≥ 90 %.
- Coach: Gewichtsaussagen erst ab ≥ 7 Messungen über ≥ 14 Tage (letzte 28 Tage), sonst Einschränkungshinweis. Vorschläge ±150 kcal (Halten ±100), nie unter die Untergrenze, nur nach Bestätigung; jede Aussage mit Datengrundlage und Begründung; Zusammenhänge als Korrelation formuliert.
- Erwartete Gewichtsänderung aus Bilanz = Ø Tagesbilanz × 7 / 7700 (nur Wochen mit ≥ 4 Tagen).
