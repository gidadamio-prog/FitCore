# Architektur

## Überblick

```
src/
  domain/        Reine Geschäftslogik (keine UI, keine DB): Typen, Energie, Nährwerte, Körper,
                 Training, Energiebilanz, Statistik, Coach, Zod-Schemas, Datumshilfen
  data/          Persistenz & Integrationen: Dexie-DB + Migrationen, Repositories, Backup/CSV,
                 Lebensmittel-Provider (Open Food Facts, USDA), Tageszusammenfassung
  hooks/         Reaktive Datenzugriffe (dexie-react-hooks/liveQuery)
  stores/        Zustand-Store für UI-Zustand (Datum, Toasts, Bestätigungsdialoge)
  components/    Designsystem (shadcn-Stil), Layout, Diagramme, Barcode-Scanner
  pages/         Bildschirme (Heute, Ernährung, Training, Körper, Statistiken, Coach, Einstellungen)
tests/           domain/ (Unit), integration/ (fake-indexeddb), live/ (echte OFF-API)
e2e/             Playwright-Benutzerreisen
```

Prinzip: **UI → Repository → Domain**. Alle Berechnungen liegen als reine Funktionen in `src/domain` und sind ohne Browser testbar. Die UI liest über `useLiveQuery`, d. h. jede Schreiboperation aktualisiert alle abhängigen Ansichten (Dashboard, Statistiken, Bilanz) sofort.

## Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| React 18 + TypeScript strict (+ `noUncheckedIndexedAccess`) + Vite 5 | wie gefordert; React 18 wegen Ökosystem-Stabilität |
| Tailwind CSS 3, eigene shadcn-artige Komponenten (`components/ui.tsx`) | **Abweichung:** shadcn/ui-CLI benötigt Netz/Registry; Komponenten wurden im shadcn-Stil (clsx + tailwind-merge, Radix-freie Dialoge) selbst geschrieben – weniger Abhängigkeiten |
| Dexie 4 / IndexedDB, `dexie-react-hooks` | Local-First, Offline, versionierte Migrationen |
| TanStack Query | nur für externe API-Abfragen (Abbruch, Deduplizierung, Retry-Steuerung) |
| Zustand | flüchtiger UI-Zustand; persistente Daten immer in IndexedDB |
| Zod 4 | Eingabevalidierung mit deutschen Fehlermeldungen, Backup-Strukturprüfung |
| Recharts 3 | Diagramme; jede Grafik mit Tabellenansicht, keine Doppelachsen |
| vite-plugin-pwa (Workbox generateSW) | Precache der App-Shell; **manuelle SW-Registrierung ohne erzwungenes Neuladen** (verhindert Verlust laufender Eingaben – im E2E-Test gefundener Fehler) |
| HashRouter | funktioniert auf jedem statischen Host/Unterordner und offline ohne Server-Rewrites |
| @zxing/browser + native BarcodeDetector | Scanner mit Fallback; manuelle Eingabe immer verfügbar |
| Vitest + RTL-Setup, fake-indexeddb, Playwright | Unit/Integration/E2E |

## Datenfluss Energiebilanz

`daySummary.buildDaySummary()` kombiniert: gültige Zielversion des Tages (`goalForDate`), Tagebuch-Summen, Workouts + Ausdauer (Duplikate per ID ausgeschlossen), Anrechnungsquote und „bereits im Aktivitätsfaktor enthalten“ → `remaining = Ziel + angerechnet − gegessen`. Da alles aus gespeicherten Primärdaten berechnet wird (keine gespeicherten Summen), bleibt die Bilanz bei nachträglichen Änderungen automatisch korrekt.

## Historische Integrität

- Tagebucheinträge speichern einen **Snapshot** der Nährwerte pro 100 g → Änderungen an Lebensmitteln/Rezepten verändern Vergangenes nicht.
- Workouts speichern Übungsnamen/Muskelgruppen/Sätze als Snapshot → Planänderungen wirken nicht zurück.
- Ziele sind **versioniert** (`effectiveFrom`); jede Änderung erzeugt eine neue Version.

## Erweiterbarkeit

- `FoodProvider`-Schnittstelle (`data/foodProviders.ts`) für weitere Datenbanken.
- `setFetch()` erlaubt Proxy/Server-Weiterleitung (z. B. für User-Agent oder geheime Schlüssel).
- Cloud-Sync vorbereitet: alle Datensätze haben stabile String-IDs und `createdAt/updatedAt`; Backup-Format ist versioniert.
- Health Connect / HealthKit: in einer PWA nicht verfügbar; Integrationspunkt wäre ein nativer Wrapper (Capacitor), der Messungen/Workouts über die Repositories schreibt.

## Sicherheit & Datenschutz

- Keine Registrierung, kein Tracking, keine Cloud. Persistenter Speicher wird per `navigator.storage.persist()` angefragt.
- An externe Dienste gehen nur Suchbegriffe und Barcodes, nie Körper-/Gesundheitsdaten; Online-Suche abschaltbar.
- Keine API-Schlüssel im Code. USDA-Key nur lokal (Einstellungen) oder via `.env` (landet im Client-Bundle – nur für private Builds).
- Bilder (Rezepte) werden lokal verkleinert und als Data-URL gespeichert.
