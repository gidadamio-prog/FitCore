# Anforderungen – Umsetzungsstand

Quelle: Masterprompt „FitCore“. ✅ umgesetzt · ◐ teilweise · ✗ nicht umgesetzt.

| Bereich | Anforderung | Stand | Hinweis |
|---|---|---|---|
| Plattform | PWA, installierbar, offline, Android/Tablet/Desktop | ✅ | Manifest, Service Worker, responsive |
| Technik | React, TS strict, Vite, Tailwind, Lucide, Zustand, Dexie, TanStack Query, Zod, Recharts, Vitest, RTL, Playwright | ✅ | shadcn/ui als eigene Komponenten im shadcn-Stil (Begründung ARCHITECTURE.md) |
| Prinzipien | Local-First, keine Registrierung, keine Cloud, keine Schlüssel im Code, versionierte Migrationen, Adapter | ✅ | |
| Design | Light/Dark, Karten, Diagramme, große Touch-Ziele, 5 Hauptbereiche + Einstellungen | ✅ | |
| Dashboard | alle geforderten Kennzahlen + 5 Schnellaktionen | ✅ | |
| Profil | geführtes Onboarding, alle Angaben, Haupt-/Nebenziele, Historie, Schutz bei Schwangerschaft/Stillzeit | ✅ | |
| Ernährung | Tagebuch, Mahlzeiten inkl. eigener, CRUD + Kopieren, Favoriten/zuletzt/häufig, eigene Lebensmittel, Portionen, Schnellbuchung | ✅ | |
| Datenbanken | OFF (Suche, Barcode, Hersteller, Nährwerte, Bilder, Portionen), USDA, Provider-Schnittstelle, Cache, Debounce, Fehler, Dedupe, Quelle, Vollständigkeit, Einheiten | ◐ | Live-Verbindung nicht verifizierbar (Sandbox); User-Agent im Browser nicht setzbar |
| Scanner | Kamera, EAN-13 u. a., Auto-Suche, manuell, unbekannt → anlegen | ✅ | |
| Rezepte | alle Felder inkl. Bild, Berechnung, Übernahme, historische Stabilität | ✅ | |
| Erweiterungen | Wochenplanung, gespeicherte Mahlzeiten, Einkaufsliste, Trinktagebuch, Trinkziel | ✅ | |
| Rechner | Mifflin, TDEE, Ziele, Makros, manuell, Konsistenz, Trainingsquote 0–100 %/frei, Doppelanrechnungsschutz, Schätzkennzeichnung, keine extremen Defizite | ✅ | zusätzlich Katch-McArdle |
| Körper | alle Messwerte + eigene, Navy mit Anleitung/Validierung/Verlauf/Vergleich, Trends 7/14/30, Ausgangswert, Zielfortschritt, Prognose mit Unsicherheit | ✅ | |
| Körper optional | Fortschrittsfotos | ✗ | ROADMAP |
| Training | Plan-Editor inkl. Split, Wochentage, Reihenfolge, Sätze, Wdh., Zielgewicht, Pause, RPE/RIR, Notizen; aktivieren, kopieren, archivieren | ✅ | RPE-Feld im Datenmodell; Editor zeigt RIR |
| Übungen | Bibliothek mit Muskeln, Equipment, Beschreibung, Alternativen, eigene | ✅ | keine Demonstrationsmedien (optional) |
| Live-Workout | Vorwerte, Ein-Tipp-Satz, Timer, Dauer, Notizen, Sätze ± , Übungswechsel, Reload-sicher | ✅ | |
| Progression | Volumen, Sätze/Muskel, Häufigkeit, Dauer, max. Gewicht, Wdh.-Bestleistung, PRs, Fortschritt, Vorschläge | ✅ | |
| Ausdauer | 6 Sportarten + eigene, Dauer, Strecke, Tempo, Pace, kcal, HF, RPE | ✅ | |
| Verknüpfung | gemeinsame Bilanz, Tagestypen, Empfehlungen, Coach, bestätigte Zielanpassung | ✅ | |
| Statistiken | Zeitfilter inkl. benutzerdefiniert, alle Ernährungs-/Trainings-/Körper-/Kombi-Auswertungen, Wochenbericht | ✅ | |
| Zusatz | Regeneration, Schlaf, Muskelkater/Energie, Meilensteine, CSV/JSON-Export | ✅ | |
| Zusatz | Erinnerungen (Push) | ✗ | ROADMAP |
| Integrationen | Health Connect, HealthKit, Cloud, KI | ✗ (vorbereitet) | in der App ausdrücklich als nicht aktiv gekennzeichnet |
