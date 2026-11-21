# FitCore

Local-first Fitness-, Ernährungs- und Körperanalyse-App als Progressive Web App (PWA).
Ernährung, Training, Körperdaten und Ziele bilden ein gemeinsames System – alle Daten bleiben im Browser (IndexedDB), ohne Konto und ohne Cloud.

**Live-App:** https://gidadamio-prog.github.io/FitCore/ (in Chrome öffnen → „App installieren“)

## Schnellstart (lokal)

Voraussetzung: **Node.js ≥ 20** (empfohlen 22 LTS).

```bash
npm install
npm run dev          # Entwicklungsserver: http://localhost:5173
# oder als installierbare PWA mit Offline-Funktion:
npm run build
npm run preview      # http://localhost:4173
```

Keine Umgebungsvariablen erforderlich. Optional siehe `.env.example` (USDA-API-Schlüssel – kann auch in der App unter *Einstellungen › App › Datenquellen* eingetragen werden).

## Auf dem Smartphone nutzen

Kamera (Barcode-Scanner), Service Worker und „Zum Startbildschirm hinzufügen“ funktionieren nur über **HTTPS** oder `localhost`.

- **Empfohlen:** Den Ordner `dist/` (nach `npm run build`) auf einen beliebigen statischen HTTPS-Host legen (z. B. GitHub Pages, Netlify, Cloudflare Pages, eigener Webserver). Die App nutzt relative Pfade und Hash-Routing und läuft in jedem Unterordner.
- Im Browser öffnen → Menü → *App installieren* / *Zum Startbildschirm*. Danach funktioniert die App auch offline.
- Im Heimnetz ohne HTTPS (`npm run preview -- --host`) läuft die App, aber ohne Kamera und Offline-Modus.

Die Daten liegen pro Gerät/Browser. Zum Umziehen: *Einstellungen › Daten › Backup exportieren* und auf dem neuen Gerät beim Start „Vorhandenes FitCore-Backup wiederherstellen“.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Typecheck + Produktions-Build (`dist/`) |
| `npm run preview` | Produktions-Build lokal ausliefern (Port 4173) |
| `npm run typecheck` | TypeScript (strict) |
| `npm run lint` | ESLint |
| `npm test` | Unit- und Integrationstests (Vitest) |
| `npm run test:e2e` | Browser-E2E-Tests (Playwright; einmalig `npx playwright install chromium` oder `PW_CHROME_PATH` setzen) |
| `npm run test:off-live` | Echter Integrationstest gegen Open Food Facts (Internet nötig) |
| `python3 scripts/make-barcode-video.py` | Erzeugt das Testvideo für den Kamerascanner-E2E-Test (optional, braucht `python-barcode`, `pillow`, `ffmpeg`) |

## Funktionsumfang (Kurzfassung)

- **Heute:** Kalorienbudget (Ziel + angerechnete Trainingsenergie − Gegessenes), Makros, Schnellaktionen, geplantes Training, letzte Leistung, Gewichtstrend, Wochenfortschritt, Coach, Tagestyp-Empfehlungen, Regeneration.
- **Ernährung:** Tagebuch mit eigenen Mahlzeiten, Open-Food-Facts-/USDA-Suche, Barcode (Kamera + manuell), eigene Lebensmittel, Favoriten/zuletzt/häufig, Schnellbuchung, Kopieren (Eintrag/Mahlzeit/Tag), gespeicherte Mahlzeiten, Rezepte (mit Bild), Wochenplanung, Einkaufsliste, Trinktagebuch.
- **Training:** Plan-Editor (Splits, Wochentage, Sätze, Wdh.-Bereich, Zielgewicht, Pause, RIR), Übungsbibliothek (60 Übungen + eigene), Live-Workout mit Vorwerten, Ein-Tipp-Satzabschluss, Pausentimer, Übungswechsel, Wiederherstellung nach Reload, Historie, Rekorde, Progressionsvorschläge, Ausdauer.
- **Körper:** Messungen (Gewicht, KF, Umfänge, eigene Werte), US-Navy-Rechner mit Anleitung, EMA-Trend, 7/14/30-Tage-Trend, Zielprognose mit Unsicherheitsbereich, Vergleich zweier Zeitpunkte.
- **Statistiken:** 7/30/90/365 Tage/eigener Zeitraum; Ernährung, Training, Körper, kombinierte Analysen, Wochenbericht; jede Grafik mit Tabellenansicht.
- **Einstellungen:** Profil, Ziele mit Historie und manueller Überschreibung, Anrechnungsquote, Doppelanrechnungsschutz, Mahlzeiten, Theme, Datenquellen, JSON-Backup/-Restore, CSV-Export.

Weitere Dokumente: `ARCHITECTURE.md`, `DATA_MODEL.md`, `REQUIREMENTS.md`, `CALCULATION_RULES.md`, `API_INTEGRATIONS.md`, `ACCEPTANCE_CRITERIA.md`, `TEST_REPORT.md`, `ROADMAP.md`.

> Alle Energie-, Trainings- und Körperfettwerte sind Schätzungen und ersetzen keine medizinische Beratung.
