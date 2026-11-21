# Akzeptanzkriterien – Status

Stand: 21.11.2026 · Alle 90 Kriterien sind P0 (Pflicht-Release).

| Status | Anzahl |
|---|---|
| BESTANDEN | 88 |
| FEHLER | 0 |
| EINGESCHRÄNKT | 1 |
| NICHT IMPLEMENTIERT | 0 |
| BLOCKIERT | 1 |

**Abschlussentscheidung: RELEASE NICHT BEREIT** – AK-017 ist BLOCKIERT (kein Netzzugang zu Open Food Facts in der Entwicklungsumgebung), AK-028 EINGESCHRÄNKT (User-Agent im Browser nicht setzbar).

Maschinenlesbar: `acceptance_criteria.csv`.

| ID | Bereich | Beschreibung | Status | Testart | Testdateien | Bekannte Einschränkungen |
|---|---|---|---|---|---|---|
| AK-001 | A Architektur | Start ohne Laufzeitfehler nach Installation | BESTANDEN | E2E | `e2e/journeys.spec.ts` | Alle E2E-Läufe gegen Produktions-Build ohne pageerror |
| AK-002 | A Architektur | Produktions-Build fehlerfrei | BESTANDEN | Build | – | npm run build |
| AK-003 | A Architektur | TypeScript Strict Mode fehlerfrei | BESTANDEN | Typecheck | – | npm run typecheck (strict, noUncheckedIndexedAccess) |
| AK-004 | A Architektur | Kein horizontales Scrollen mobil/desktop | BESTANDEN | E2E | `e2e/responsive.spec.ts` | 11 Routen, Pixel 7 (412px) + 1280px |
| AK-005 | A Architektur | Tagebuch, Pläne, Körperdaten offline | BESTANDEN | E2E | `e2e/offline-backup.spec.ts` | E2E-11 mit Service Worker + context.setOffline |
| AK-006 | A Architektur | Daten bleiben nach Neustart erhalten | BESTANDEN | Integration+E2E | `tests/integration/persistence.test.ts`, `e2e/journeys.spec.ts` | DB schließen/neu öffnen + Seiten-Reload; echter Browser-Neustart nur manuell geprüft |
| AK-007 | A Architektur | Versionierte Migration ohne Datenverlust | BESTANDEN | Integration | `tests/integration/persistence.test.ts` | v1→v2 inkl. Feldumbenennung |
| AK-008 | A Architektur | Backup Export/Restore in frischer Instanz | BESTANDEN | Integration+E2E | `tests/integration/persistence.test.ts`, `e2e/offline-backup.spec.ts` | E2E-12 in getrenntem Browserkontext |
| AK-009 | B Profil | Profil per Onboarding anlegen | BESTANDEN | E2E | `e2e/journeys.spec.ts` | E2E-01 |
| AK-010 | B Profil | Profildaten änderbar und persistent | BESTANDEN | Integration | `tests/integration/persistence.test.ts` | – |
| AK-011 | B Profil | Ziele Abnehmen/Halten/Aufbau/Rekomposition wählbar | BESTANDEN | Unit | `tests/domain/energy.test.ts` | alle 8 Ziele |
| AK-012 | B Profil | BMR-Referenz 80/180/30 +5 = 1780 | BESTANDEN | Unit | `tests/domain/energy.test.ts` | – |
| AK-013 | B Profil | TDEE nachvollziehbar aus Methode + Aktivität | BESTANDEN | Unit+E2E | `tests/domain/energy.test.ts`, `e2e/journeys.spec.ts` | Aufschlüsselung in Einstellungen > Ziele |
| AK-014 | B Profil | Kalorien-/Makroziele manuell überschreibbar | BESTANDEN | E2E | `e2e/journeys.spec.ts` | inkl. Konsistenzanzeige Makro-kcal |
| AK-015 | B Profil | Zieländerungen historisiert | BESTANDEN | Unit+Integration | `tests/domain/balance.test.ts`, `tests/integration/persistence.test.ts` | effectiveFrom-Versionierung |
| AK-016 | B Profil | Ungültige Eingaben mit verständlichen Fehlern abgelehnt | BESTANDEN | Unit+Integration+E2E | `tests/domain/energy.test.ts`, `tests/integration/persistence.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-017 | C Lebensmittel | Echte OFF-Suche liefert echte Datensätze | BLOCKIERT | Live-Integration | `tests/live/off.live.test.ts` | Test vorhanden (npm run test:off-live); Sandbox-Netzwerk blockiert openfoodfacts.org (HTTP 403 am Proxy). Beim ersten Start mit Internet ausführen. |
| AK-018 | C Lebensmittel | Produktsuche per Barcode | BESTANDEN | Integration+E2E | `tests/integration/providers.test.ts`, `e2e/journeys.spec.ts` | gegen simulierte, dokumentierte OFF-v2-Antwort; Live-Abruf siehe AK-017 |
| AK-019 | C Lebensmittel | Kamerascanner erkennt gültigen Barcode | BESTANDEN | E2E | `e2e/scanner.spec.ts` | Chrome mit simulierter Kamera (Y4M), ZXing-Fallback; native BarcodeDetector-Variante und echtes Smartphone nur manuell zu prüfen |
| AK-020 | C Lebensmittel | Manuelle Barcodeeingabe ohne Kamera | BESTANDEN | E2E | `e2e/journeys.spec.ts` | – |
| AK-021 | C Lebensmittel | Kalorien/Makros in korrekten Einheiten | BESTANDEN | Unit+Integration | `tests/domain/nutrition.test.ts`, `tests/integration/providers.test.ts` | kJ→kcal, Natrium→Salz, ml-Erkennung |
| AK-022 | C Lebensmittel | Fehlende Nährwerte als unbekannt | BESTANDEN | Unit+Integration | `tests/domain/nutrition.test.ts`, `tests/integration/providers.test.ts` | null ≠ 0 in Speicherung, Summen und UI |
| AK-023 | C Lebensmittel | Portionsmengen proportional (200 g × 150 kcal/100 g = 300) | BESTANDEN | Unit | `tests/domain/nutrition.test.ts` | – |
| AK-024 | C Lebensmittel | Eigene Lebensmittel erstellen/finden | BESTANDEN | Integration+E2E | `tests/integration/nutrition.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-025 | C Lebensmittel | Datenquelle je Datensatz nachvollziehbar | BESTANDEN | Integration | `tests/integration/providers.test.ts` | source, sourceId, sourceUrl, license |
| AK-026 | C Lebensmittel | API-Fehler/Timeout/fehlende Produkte ohne Absturz | BESTANDEN | Integration | `tests/integration/providers.test.ts` | network, timeout, http, rate_limit, parse |
| AK-027 | C Lebensmittel | Cache für identische Anfragen | BESTANDEN | Integration | `tests/integration/providers.test.ts` | 24 h Suche, 7 Tage Produkt, Offline-Fallback |
| AK-028 | C Lebensmittel | Anbieterinformationen (Lizenz, Pflichtangaben) | EINGESCHRÄNKT | Integration+Manuell | `tests/integration/providers.test.ts` | ODbL-/CC-BY-SA-/CC0-Hinweise umgesetzt. OFF verlangt einen eigenen User-Agent – Browser verbieten diesen Header; ersatzweise app_name/app_version-Parameter. Für vollständige Konformität Server-Proxy nötig. |
| AK-029 | D Tagebuch | Zuordnung Frühstück/Mittag/Abend/Snacks/eigene Mahlzeiten | BESTANDEN | Integration+E2E | `tests/integration/nutrition.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-030 | D Tagebuch | Hinzufügen/Löschen aktualisiert Summen sofort | BESTANDEN | Integration+E2E | `tests/integration/nutrition.test.ts`, `e2e/journeys.spec.ts` | reaktive Dexie-liveQuery |
| AK-031 | D Tagebuch | Mengenänderung korrigiert Tagessummen | BESTANDEN | Integration+E2E | `tests/integration/nutrition.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-032 | D Tagebuch | Mahlzeiten kopieren ohne Originale zu ändern | BESTANDEN | Integration | `tests/integration/nutrition.test.ts` | Mahlzeit, Tag, Einzeleintrag |
| AK-033 | D Tagebuch | Favoriten & erneut buchen | BESTANDEN | Integration | `tests/integration/nutrition.test.ts` | – |
| AK-034 | D Rezepte | Rezept aus ≥ 2 Zutaten | BESTANDEN | Integration+E2E | `tests/integration/nutrition.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-035 | D Rezepte | Rezeptnährwerte aus Zutaten korrekt | BESTANDEN | Unit+E2E | `tests/domain/nutrition.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-036 | D Rezepte | Portionsanzahl ändert nur pro Portion | BESTANDEN | Unit | `tests/domain/nutrition.test.ts` | – |
| AK-037 | D Rezepte | Historische Buchungen bei Rezeptänderung stabil | BESTANDEN | Integration | `tests/integration/nutrition.test.ts` | Snapshot je Eintrag |
| AK-038 | D Tagebuch | Tageswerte = Summe der Einträge | BESTANDEN | Unit+Integration | `tests/domain/nutrition.test.ts`, `tests/integration/nutrition.test.ts` | – |
| AK-039 | E Körper | Gewicht/Umfänge mit Datum speichern | BESTANDEN | Integration+E2E | `tests/integration/persistence.test.ts`, `e2e/offline-backup.spec.ts` | – |
| AK-040 | E Körper | Messungen bearbeiten und löschen | BESTANDEN | Integration | `tests/integration/persistence.test.ts` | UI: Messungen-Tab > Eintrag |
| AK-041 | E Körper | Navy: korrekte Formeln + Validierung | BESTANDEN | Unit+E2E | `tests/domain/body.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-042 | E Körper | Navy: ≥ 5 unabhängige Referenztests + ungültige Werte | BESTANDEN | Unit | `tests/domain/body.test.ts` | 6 Referenzfälle (Python) + Zoll-Fall + SI-Gegenprüfung; 5 Fehlerfälle |
| AK-043 | E Körper | Fett-/fettfreie Masse korrekt | BESTANDEN | Unit | `tests/domain/body.test.ts` | – |
| AK-044 | E Körper | Gemessene vs. geschätzte KF-Werte unterscheidbar | BESTANDEN | E2E | `e2e/journeys.spec.ts` | Badge + getrennte Diagrammserien |
| AK-045 | E Körper | Gewichtstrend aus echten Messungen, dokumentierte Glättung | BESTANDEN | Unit | `tests/domain/body.test.ts` | zeitgewichteter EMA α=0,1 |
| AK-046 | E Körper | Diagramme chronologisch korrekt | BESTANDEN | Unit+E2E | `tests/domain/body.test.ts`, `e2e/journeys.spec.ts` | inkl. mehrerer Messungen am selben Tag |
| AK-047 | E Körper | Keine erfundenen Messwerte | BESTANDEN | Unit+Integration | `tests/domain/body.test.ts`, `tests/integration/persistence.test.ts` | Lücken bleiben Lücken |
| AK-048 | E Körper | Vergleich zweier Zeitpunkte | BESTANDEN | Unit | `tests/domain/body.test.ts` | UI: Körper > Vergleich |
| AK-049 | F Training | Plan mit Name + ≥ 1 Trainingstag | BESTANDEN | Integration+E2E | `tests/integration/training.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-050 | F Training | Mehrere Übungen je Trainingstag | BESTANDEN | Integration+E2E | `tests/integration/training.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-051 | F Training | Sätze/Wdh./Zielgewicht je Übung | BESTANDEN | Integration+E2E | `tests/integration/training.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-052 | F Training | Übungen umsortieren | BESTANDEN | Integration | `tests/integration/training.test.ts` | UI: Pfeiltasten im Plan-Editor |
| AK-053 | F Training | Pläne speichern/bearbeiten/duplizieren/archivieren | BESTANDEN | Integration | `tests/integration/training.test.ts` | – |
| AK-054 | F Training | Aktivierter Plan im Dashboard | BESTANDEN | E2E | `e2e/journeys.spec.ts` | – |
| AK-055 | F Training | Übung per Suche finden | BESTANDEN | Integration+E2E | `tests/integration/training.test.ts`, `e2e/journeys.spec.ts` | 60 mitgelieferte Übungen |
| AK-056 | F Training | Eigene Übungen dauerhaft speichern | BESTANDEN | Integration | `tests/integration/training.test.ts` | – |
| AK-057 | F Training | Planänderung ändert abgeschlossene Workouts nicht | BESTANDEN | Integration | `tests/integration/training.test.ts` | – |
| AK-058 | G Workout | Workout aus aktivem Plan starten | BESTANDEN | Integration+E2E | `tests/integration/training.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-059 | G Workout | Gewicht/Wdh. je Satz | BESTANDEN | Integration+E2E | `tests/integration/training.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-060 | G Workout | Satz mit einer Touch-Aktion abschließen | BESTANDEN | E2E | `e2e/journeys.spec.ts` | – |
| AK-061 | G Workout | Pausentimer starten/anhalten/zurücksetzen | BESTANDEN | E2E | `e2e/journeys.spec.ts` | – |
| AK-062 | G Workout | Laufendes Workout nach Neuladen wiederhergestellt | BESTANDEN | Integration+E2E | `tests/integration/training.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-063 | G Workout | Workout abschließen und speichern | BESTANDEN | Integration+E2E | `tests/integration/training.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-064 | G Workout | Historie abgeschlossener Workouts | BESTANDEN | E2E | `e2e/journeys.spec.ts` | – |
| AK-065 | G Workout | Volumen 3×10×60 = 1800 kg | BESTANDEN | Unit+E2E | `tests/domain/training.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-066 | G Workout | Bestleistungen aus echten Werten | BESTANDEN | Unit | `tests/domain/training.test.ts` | – |
| AK-067 | G Workout | Übungsverlauf grafisch vergleichbar | BESTANDEN | E2E | `e2e/journeys.spec.ts` | – |
| AK-068 | G Workout | Ausdauer mit Sportart/Dauer/optionaler Distanz | BESTANDEN | Integration | `tests/integration/training.test.ts` | – |
| AK-069 | H Verknüpfung | Workout erzeugt geschätzten Energieverbrauch | BESTANDEN | Unit+Integration | `tests/domain/training.test.ts`, `tests/integration/training.test.ts` | Netto-MET |
| AK-070 | H Verknüpfung | Anrechnungsquote einstellbar | BESTANDEN | Unit+E2E | `tests/domain/balance.test.ts`, `e2e/journeys.spec.ts` | 0/25/50/75/100 % + frei |
| AK-071 | H Verknüpfung | 2000 + 300 − 1500 = 800 | BESTANDEN | Unit+E2E | `tests/domain/balance.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-072 | H Verknüpfung | Quote 0 % ändert Budget nicht | BESTANDEN | Unit+Integration+E2E | `tests/domain/balance.test.ts`, `tests/integration/training.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-073 | H Verknüpfung | Nachträgliche Änderung der Trainingsenergie | BESTANDEN | Unit+Integration | `tests/domain/balance.test.ts`, `tests/integration/training.test.ts` | – |
| AK-074 | H Verknüpfung | Keine Doppelanrechnung mit Aktivitätsfaktor | BESTANDEN | Unit+Integration | `tests/domain/balance.test.ts`, `tests/integration/training.test.ts` | – |
| AK-075 | H Verknüpfung | Kein doppelt erfasstes/angerechnetes Training | BESTANDEN | Unit+Integration | `tests/domain/balance.test.ts`, `tests/domain/training.test.ts`, `tests/integration/training.test.ts` | idempotenter Abschluss + Ausdauer-Duplikatprüfung |
| AK-076 | H Verknüpfung | Trainingskalorien als Schätzung gekennzeichnet | BESTANDEN | E2E | `e2e/journeys.spec.ts` | „geschätzt“ in Dashboard, Tagebuch, Historie |
| AK-077 | H Verknüpfung | Lebensmitteländerung aktualisiert gemeinsame Bilanz | BESTANDEN | Integration | `tests/integration/training.test.ts` | – |
| AK-078 | H Verknüpfung | Empfehlungen ändern Ziele nur nach Bestätigung | BESTANDEN | Unit+Manuell | `tests/domain/stats.test.ts` | Coach-Vorschläge nur über Bestätigungsdialog |
| AK-079 | I Statistik | Kalorien/Makros für 7/30/90 Tage grafisch | BESTANDEN | Unit+E2E | `tests/domain/stats.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-080 | I Statistik | Trainingshäufigkeit/-volumen korrekt aggregiert | BESTANDEN | Unit+E2E | `tests/domain/stats.test.ts`, `e2e/journeys.spec.ts` | – |
| AK-081 | I Statistik | Gewichtstrend gemeinsam mit Kalorienaufnahme | BESTANDEN | Manuell | – | Statistiken > Kombiniert (Screenshot-Prüfung); bewusst ohne Doppelachse |
| AK-082 | I Statistik | Trainings- und Körperfortschritt im gleichen Zeitraum | BESTANDEN | Manuell | – | Kraft- und Gewichtsindex auf gemeinsamer Achse (Screenshot-Prüfung) |
| AK-083 | I Statistik | Zielerreichung auf auswertbaren Tagen + Lückenausweis | BESTANDEN | Unit | `tests/domain/stats.test.ts` | – |
| AK-084 | I Statistik | Wochenbericht mit echten Ø und Veränderung | BESTANDEN | Unit | `tests/domain/stats.test.ts` | – |
| AK-085 | I Statistik | Coach-Trend ab 14 Tagen, sonst Einschränkung | BESTANDEN | Unit | `tests/domain/stats.test.ts` | – |
| AK-086 | I Statistik | Empfehlungen mit Datengrundlage, nicht automatisch | BESTANDEN | Unit | `tests/domain/stats.test.ts` | – |
| AK-087 | J Qualität | Essen/Training/Gewicht in ≤ 3 Interaktionen | BESTANDEN | E2E | `e2e/responsive.spec.ts` | jeweils 1 Interaktion |
| AK-088 | J Qualität | Hauptbereiche auf Smartphone & Desktop bedienbar | BESTANDEN | E2E | `e2e/responsive.spec.ts` | Touch-Ziele ≥ 40 px, Dialog-Buttons im Viewport |
| AK-089 | J Qualität | Echte Daten, keine funktionslosen Bedienelemente | BESTANDEN | E2E+Manuell | `e2e/journeys.spec.ts` | Code-Review aller Buttons; keine Demo-/Mock-Daten im Produktcode |
| AK-090 | J Qualität | P0-Tests, TypeScript, Linting, Build erfolgreich | BESTANDEN | CI-Befehle | – | 118 Unit/Integration, 17 E2E grün; Live-Test AK-017 als Blocker ausgewiesen |
