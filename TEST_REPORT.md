# Testbericht

Ausgeführt am 21.11.2026 in einer Linux-Sandbox (Node 22, Chrome 14x, ohne Internetzugang zu Drittanbietern).

| Prüfung | Ergebnis |
|---|---|
| TypeScript strict (`npm run typecheck`) | **bestanden** |
| ESLint (`npm run lint`) | **bestanden** (0 Fehler, 0 Warnungen) |
| Produktions-Build (`npm run build`) | **bestanden** (PWA, 14 precache-Einträge) |
| Unit-Tests (`tests/domain`) | **83 / 83 bestanden** |
| Integrationstests (`tests/integration`, fake-indexeddb) | **35 / 35 bestanden** |
| Browser-E2E (`npm run test:e2e`, Playwright) | **17 / 17 bestanden** (3 Läufe in Folge stabil) |
| Live-Integration Open Food Facts (`npm run test:off-live`) | **blockiert** – 0 / 1 (Proxy der Sandbox verweigert openfoodfacts.org, HTTP 403) |

## Abdeckung nach Testart

**Unit:** Mifflin/Katch/TDEE/Zielkalorien inkl. Sicherheitsgrenzen und Sondersituationen, Makros und Konsistenz, Portionsskalierung und Rundung, Summen mit unbekannten Werten, Etikett-vs.-Makro-kcal, Rezepte, Einheiten (kJ, mg, Natrium), Navy (6 Referenzfälle + Zoll-Fall, SI-Gegenprüfung, 5 Fehlerfälle), Fett-/fettfreie Masse, EMA-Trend mit Lücken, Gleitmittel, Fenstertrends, Prognose, Messvergleich, Volumen, Muskelgruppen, Epley, Rekorde, Progression, MET-Schätzung, Pace, Ausdauer-Duplikate, Energiebilanz (Quoten, Override, Aktivitätsfaktor, Duplikate), Zielhistorie, Statistikaggregation mit Lücken, Zielerreichung, Wochenbericht, Coach (≥ 14 Tage, Vorschläge, Protein), Tagestyp-Empfehlungen.

**Integration:** Persistenz über DB-Neuöffnung, Profiländerung + Validierung, Zielversionierung, Migration v1→v2, Backup/Restore (byte-gleich), Messungen CRUD, Tagebuch (alle Mahlzeiten, Mengenänderung, Kopieren ohne Seiteneffekt, Favoriten, Schnellbuchung, gespeicherte Mahlzeiten), Rezepte (historische Stabilität), Pläne (Umsortieren, Duplizieren, Aktivieren, Archivieren, Validierung), Übungssuche/eigene Übungen, Live-Workout (Wiederherstellung, Abschluss, Idempotenz), Ausdauer (Duplikatschutz), gemeinsame Energiebilanz bei Änderungen, OFF-/USDA-Adapter mit simulierten Antworten (Normalisierung, Cache, Offline-Fallback, Fehlerarten, Rate-Limiter, Dedupe, fehlender Schlüssel).

**E2E (Pixel 7 + Desktop 1280 px):** E2E-01 … E2E-12 vollständig, dazu AK-004/088 (kein horizontales Scrollen auf 11 Routen, Touch-Ziele), AK-087 (je 1 Interaktion), AK-016 (Validierung im Onboarding), AK-019 (Kamerascanner mit simulierter Kamera, ZXing). Externe APIs werden in E2E kontrolliert simuliert.

## Während der Tests gefundene und behobene Fehler
1. Navy-Rechner übernahm die Körpergröße nicht, wenn das Profil asynchron nachlud → Vorbelegung reaktiv.
2. Service Worker löste beim ersten Aktivieren ein Neuladen aus und konnte Eingaben (z. B. Backup-Import im Onboarding) verwerfen → manuelle Registrierung ohne Zwangs-Reload.
3. Mehrere Messungen am selben Tag wurden nicht stabil chronologisch sortiert → Sortierung nach Datum + Erfassungszeit.
4. „Letzte Messung“ zeigte das Tagesmittel statt des letzten Werts.
5. Englische Zod-Standardmeldungen bei leeren Pflichtfeldern → deutsche Meldungen.
6. Wiederhergestellte Backups ohne Übungsbibliothek → Bibliothek wird nach Restore ergänzt.

## Bekannte Einschränkungen
- Live-Verbindung zu Open Food Facts/USDA und CORS aus dem Browser nicht verifiziert (AK-017 blockiert).
- OFF-User-Agent im Browser nicht setzbar (AK-028 eingeschränkt).
- Kamerascanner nur mit simulierter Kamera in Chrome/ZXing getestet; native BarcodeDetector-Variante und echte Geräte manuell prüfen.
- Ein „echter“ Browser-Neustart wurde durch DB-Neuöffnung und Seiten-Reload simuliert.
- Wird die Seite innerhalb weniger Millisekunden nach einer Eingabe im Live-Workout neu geladen, kann diese letzte Eingabe verloren gehen (IndexedDB schreibt asynchron).
