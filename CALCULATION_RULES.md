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
- Anpassung im Tagesverlauf: Mahlzeiten mit Einträgen gelten als gegessen, in der Reihenfolge ihres ersten Eintrags. Jede gegessene Mahlzeit behält das Ziel, das galt, als sie begonnen wurde. Rest = Tagesbudget − bereits gegessene kcal (nie < 0) wird auf die offenen Mahlzeiten im Verhältnis ihrer Anteile verteilt (alle offenen 0 % → gleichmäßig).
- Punktlandung: |gegessen − gültiges Ziel| ≤ max(10 % des Ziels, 20 kcal); Ziel 0 zählt nie. Perfekter Tag: ≥ 3 Punktlandungen und keine gegessene Mahlzeit verfehlt.

## Energiebilanz
- anrechenbar = max(0, Σ Trainings-kcal − bereits enthaltene kcal (falls „Training im Aktivitätsfaktor“)); angerechnet = anrechenbar × Quote.
- **Verbleibend = Ziel + angerechnet − gegessen** (2000 + 300 − 1500 = 800).
- Trainings werden per ID dedupliziert; Workout-Abschluss ist idempotent; Ausdauer-Duplikat = gleiche Sportart, Start ±5 min, gleiche Dauer.

## Statistik & Coach
- Fehlende Tage = Lücke (null). Zielerreichung = Tage mit |kcal − Ziel| ≤ 10 % / auswertbare Tage; Lücken werden ausgewiesen. Protein erreicht = ≥ 90 %.
- Coach: Gewichtsaussagen erst ab ≥ 7 Messungen über ≥ 14 Tage (letzte 28 Tage), sonst Einschränkungshinweis. Vorschläge ±150 kcal (Halten ±100), nie unter die Untergrenze, nur nach Bestätigung; jede Aussage mit Datengrundlage und Begründung; Zusammenhänge als Korrelation formuliert.
- Erwartete Gewichtsänderung aus Bilanz = Ø Tagesbilanz × 7 / 7700 (nur Wochen mit ≥ 4 Tagen).

## RPG (Held, Bosse, Arena)
- Alles wird aus den echten Einträgen abgeleitet; gespeichert werden nur Held, Käufe und Rivalen. Jede EP wird dem Tag zugeordnet, an dem sie verdient wurde (Feldzug: Wochenende bzw. heute, Saison: Monatsende bzw. heute).
- Zusätzliche EP: Punktlandung 5 (max. 4/Tag), perfekter Tag 15, Comeback 50 (≥ 7 trainingsfreie Tage davor, max. alle 14 Tage), Schatten-Duell gewonnen 40 (abgeschlossene Woche), Meisterschaftsstufe 25, Feldzugs-Boss 150, Kolosseum-Sieg 200.
- Stufe L = ⌊√(EP/40)⌋ + 1 (max. 99). Attribut-Stufe = 1 + ⌊1,5·√Punkte⌋; Punkte: Stärke = Volumen/500 + 5·PR, Ausdauer = Ausdauerminuten/10 + km, Disziplin = 2·Protokolltag + Punktlandung + 2·Proteintag + 5·Feldzug, Vitalität = 2·Trinkziel + 2·Erholung + Messung, Gewandtheit = Mobility-Sätze/2. Klassen-Hauptattribut × 1,1.
- Tagesschaden: Volumen/40 + 4·Ausdauerminuten + (20 Protokoll + 15 Protein + 15 Kalorienziel + 10·Punktlandung) + (10 Trinkziel + 10 Erholung + 5 Messung) + 8·Mobility-Satz + 40·PR (max. 5). Klassenbonus: Legionär Kraft × 1,25; Gladiator PR × 1,5, Beweglichkeit × 1,25; Cursor Ausdauer × 1,25; Stratege Disziplin und Vitalität × 1,25. Kein Schaden für Defizit.
- Feldzug: 12 Bosse (1.000 … 30.000 LP), Überschuss geht auf den nächsten über, danach endlos 30.000 LP. Kolosseum: 4.500 LP Schaden je Kalendermonat.
- Schatten-Duell: Woche vs. Woche 4 Wochen davor (laufende Woche: gleich viele Tage) in Einheiten, Volumen, Protokolltagen, Ausdauerminuten; gewonnen bei mehr Siegen als Niederlagen, nur wenn die Schattenwoche Daten hat.
- Meisterschaft: Bankdrücken, Kniebeuge, Kreuzheben, Schulterdrücken (LH), Langhantelrudern über e1RM ÷ Körpergewicht (Richtwerte Männer, Frauen × 0,65; Orientierung, keine Norm); andere Übungen über Steigerung des besten e1RM gegenüber der ersten Einheit (+10/25/50/100 %). e1RM nur aus Sätzen ≤ 12 Wdh.
- Kampfwert = Summe der EP der letzten 28 Tage (startunabhängig vergleichbar); Ø EP/Woche = Gesamt-EP ÷ max(7, Tage seit erstem aktiven Tag) × 7. Denare = ⌊EP/10⌋ − Käufe.
- Teilen: Code „FC1.<base64url(JSON)>.<FNV-1a-Prüfsumme>“ enthält nur Spielwerte (Name, Klasse, Wappen, Titel, Stufe, EP, Kampfwert, Ø/Woche, Tage seit Start, Bosse, Kolosseum-Siege, Datum). Keine Körper- oder Ernährungsdaten. Prüfsumme erkennt Übertragungsfehler, nicht Manipulation.

## Ausrüstung, Erscheinungsbild, Klasse und Lebensweg
- Ausrüstung ist rein kosmetisch (kein Einfluss auf Schaden, EP oder Kampfwert). 6 Slots; Zweihandwaffen leeren die Nebenhand, Nebenhand bei Zweihandwaffe tauscht auf eine Einhandwaffe.
- Start-Set der eigenen Klasse ist Gewöhnlich. Achievement-Teile: Bronze = Selten, Silber = Episch, Gold = Legendär. Tragbar: Selten ab Rang 1, Episch ab Optio (5), Legendär ab Primus Pilus (7); höhere Freischaltungen werden bis dahin in der höchsten erlaubten Seltenheit getragen. Set-Aura bei 3 getragenen Teilen derselben Kategorie.
- Erscheinungsbild-Stufe = ⌈Rang/2⌉ (1–5).
- Klasse bestimmt Trainingsfokus, empfohlene Vorlagen und einen zusätzlichen wöchentlichen Klassen-Feldzug (Legionär 3 Krafteinheiten, Gladiator 4 Einheiten, Cursor 120 Ausdauerminuten, Stratege 5 Tage Protein- und Trinkziel).
- Lebensweg ist eine Oberfläche für das Ernährungsziel: Asket = Fettabbau (high protein), Stoiker = Rekomposition (high protein), Epikureer = Muskelaufbau (ausgewogen); gleiche Berechnung und Sicherheitsgrenzen wie der Zielrechner, Wechsel legt eine neue Zielversion an.
- Geheime Erfolge: Frühaufsteher (Training vor 7 Uhr), Doppelschicht (2 Einheiten an einem Tag), Säulen des Reiches (8 Wochen in Folge Beintraining), Wiedersehen (PR innerhalb 7 Tagen nach Comeback), Stoische Ruhe (30 Tage in Folge Kalorienziel ± 10 %). Belohnung: Titel und 50–150 Denare.

## Grundkörper des Helden

Der Held zeigt einen von 12 Körperbauten (`src/domain/bodyType.ts`). Er ist unabhängig vom Rang – Rang und Erfolge zeigt die Ausrüstung.

- **Eingaben:** Gewicht als 7-Tage-Durchschnitt, letzter gemessener KFA (sonst Profil-KFA, sonst Schätzung nach Deurenberg: 1,2·BMI + 0,23·Alter − 16,2 bzw. − 5,4 bei Frauen; Anzeige „geschätzt“), letzte Größe.
- **FFMI** (normalisiert, Kouri 1995): fettfreie Masse / Größe² + 6,1·(1,8 − Größe in m).
- **Muskel-Score** = FFMI − 0,2·max(0, KFA − 15). Mehr Fett bringt auch ohne Training mehr fettfreie Masse; ohne Korrektur würden schwere Untrainierte als Strongman erscheinen.
- **Stufen:** KFA < 12 · 12–18 · 18–25 · 25–32 · ≥ 32 % (Frauen + 9 Punkte); Muskel-Score < 19 · 19–21,5 · 21,5–23,5 · 23,5–25,5 · ≥ 25,5.
- **Hysterese:** Eine Stufe wechselt erst, wenn die Grenze um 0,7 KFA-Punkte bzw. 0,3 Score-Punkte überschritten ist. Die Historie wird Tag für Tag durchlaufen, daher ohne gespeicherten Zustand reproduzierbar.

| Muskel \ KFA | < 12 | 12–18 | 18–25 | 25–32 | ≥ 32 |
| --- | --- | --- | --- | --- | --- |
| untrainiert | Dünn | Schlank | Durchschnitt | Übergewichtig | Adipös |
| leicht trainiert | Fit | Fit | Kräftig | Übergewichtig | Adipös |
| trainiert | Athletisch | Athletisch | Muskulös mit Bauch | Kräftig | Adipös |
| sehr muskulös | Bodybuilder | Bodybuilder | Muskulös mit Bauch | Strongman | Strongman |
| extrem | Bodybuilder | Bodybuilder | Strongman | Koloss | Koloss |

## Kampf gegen den Feldzug-Boss

Nach „Training abschließen“ und „Mahlzeit abschließen“ kämpft der Held gegen den aktuellen Boss (`src/domain/battle.ts`). Der Feldzug selbst bleibt unverändert aus den Tagesdaten berechnet – der Kampf inszeniert nur den Zuwachs.

- **Schaden des Kampfs** = Gesamtschaden jetzt − Gesamtschaden beim letzten Kampf (`settings.battleAck`, beim ersten Start still initialisiert). Alles seit dem letzten Kampf zählt mit (z. B. Wasser, Wiegen). Kein Zuwachs → kein Kampf.
- **Angriffe:** höchstens 4, nach Bereichen im Verhältnis des heutigen Tagesschadens; der stärkste kommt zuletzt. Besiegt ein Angriff den Boss, wird er geteilt und der Rest trifft den nächsten Boss.
- **Abgeschlossene Mahlzeiten** werden je Tag gespeichert (`settings.closedMeals`, letzte 14 Tage) und können nur heute abgeschlossen werden.
- Feiern (Bestleistung, Boss besiegt, Abzeichen …) erscheinen erst nach dem Kampf. Mit „Animationen reduzieren“ erscheint direkt das Ergebnis.

## Trainingsdauer nachträglich korrigieren

Wurde „Training abschließen“ vergessen, lässt sich die Dauer in der Zusammenfassung per Minuten oder Endzeit korrigieren (`updateWorkoutDuration`, 1–600 min). Ende = Start + Dauer; die geschätzte Trainingsenergie wird mit der neuen Dauer neu berechnet (gleiche MET-Formel). Ein manuell gesetzter kcal-Wert bleibt unverändert und hat weiterhin Vorrang.

## Quest-Brett (Feldzug der Woche) und Tagesaufträge

Ab 23.11.2026 (`QUEST_BOARD_START`, `src/domain/quests.ts`); ältere Wochen behalten die bisherigen Wochen-Feldzüge.

- **Angebote:** Jede Woche 5 Aufträge (mind. 2 Training, 2 Ernährung, 1 Alltag), zufällig aus einem Pool von ca. 20 – je Woche anders, innerhalb der Woche stabil. Du wählst 3; die Wahl gilt bis Sonntag.
- **Ziele:** aus deinem Schnitt der 4 Wochen davor, meist „Schnitt + 1“ bzw. +10–25 % (z. B. Schnitt 2 Einheiten → 3× trainieren; Protein an 3 Tagen → an 4 Tagen). Feste Untergrenzen verhindern zu leichte Ziele.
- **Ernährungs-Aufträge:** u. a. „Festmahl des Herkules“ (2 Tage ≥ 120 % Protein) und „Fastentag des Asketen“ (1 Tag mit 75–90 % des Kalorienziels, mind. 2 Mahlzeiten erfasst; zählt erst am Folgetag; unter 75 % zählt bewusst nicht).
- **EP:** je erfülltem Feldzug 100, alle drei +100 Bonus.
- **Tagesaufträge:** an ca. 60 % der Tage einer aus 11 (z. B. „Trainiere heute“ – an Plantagen häufiger –, „Eilmarsch: Schrittziel + 2.000“, „Proteinration +10 %“); stabil je Datum; 40 EP.
- **Schritte:** manuell je Tag (`recovery.steps`), Tagesziel in den Einstellungen (Standard 8.000); Ziel erreicht = 10 EP.

## Makroziele am Trainingstag

Angerechnete Trainings-kcal (siehe Anrechnungsquote) erhöhen auch die Makroziele: 70 % als Kohlenhydrate, 15 % Protein, 15 % Fett (`trainingDayMacros`). Ohne Anrechnung (0 %) bleiben die Ziele gleich – die App weist an Trainingstagen darauf hin.


## Backup und Erinnerung
- „In OneDrive sichern“ übergibt das vollständige Backup ans Teilen-Menü des Handys (Web Share API). Android-Chrome erlaubt dort keine `.json`-Dateien, deshalb heißt die Datei `fitcore-backup-<Datum>.txt` (Inhalt = JSON-Backup). Ohne Teilen-Funktion (Desktop) wird die Datei heruntergeladen. Wiederherstellen akzeptiert `.json` und `.txt`.
- Jede Sicherung (Teilen oder Herunterladen) setzt `lastBackupAt`. Abbruch im Teilen-Menü zählt nicht.
- Erinnerung auf „Heute“: noch nie gesichert und Profil ≥ 3 Tage alt, oder letztes Backup ≥ 7 Tage alt. „Später“ blendet sie 2 Tage aus.

## Merkmal- und Helm-Ebenen
- Raster 1024 × 1536, Ebenenfolge Grundkörper → Narbe → Bemalung → Bart → Frisur → Augen → Helm. Haare und Bärte werden grau geliefert und im Code eingefärbt (`HAIR_COLORS`). Echte Helme blenden die Frisur aus, Kränze/Diademe nicht (`helmetHidesHair`). Katalog: `src/domain/appearance.ts`.
