# Datenmodell (IndexedDB „fitcore“, Schema v2)

Typdefinitionen: `src/domain/types.ts`. Schema & Migrationen: `src/data/db.ts`.

| Tabelle | Schlüssel / Indizes | Inhalt |
|---|---|---|
| profile | `id` (= "me") | Name, Geburtsdatum, Geschlecht (für Formeln), Größe, Aktivität, Erfahrung, Equipment, besondere Situation, Zielgewicht, Anrechnungsquote, „Training im Aktivitätsfaktor“ + enthaltene kcal |
| goals | `++id`, effectiveFrom | **Versionierte** Ziele: Hauptziel, Nebenziele, Rate kg/Woche, Strategie, Formel, BMR, TDEE, Anpassung, kcal-/Makroziele, manuell-Flags, Grund |
| foods | id, name, barcode, source, favorite, useCount, lastUsedAt | Lebensmittel (OFF/USDA/eigen), `per100` (null = unbekannt), Portionen, Quelle/Lizenz/URL, kcal-Herkunft |
| diary | id, date, meal, foodId, recipeId, [date+meal] | Einträge mit Menge/Einheit/Gramm, optional Zubereitung `prep` (dann ist `per100` darauf umgerechnet), **Snapshot `per100`** und berechneten Nährwerten |
| recipes | id, name, category | Zutaten (Snapshot per100 + Gramm), Portionen, Zubereitung, Bild |
| measurements | id, date, bodyFatMethod | Gewicht, Größe, KF% + Methode (manual/device/navy), Muskelmasse, Umfänge, eigene Werte, Notiz |
| exercises | id, name, primaryMuscle, isCustom | Übungsbibliothek (60 mitgeliefert) + eigene |
| plans | id, status, updatedAt | Pläne: Split, Status (draft/active/archived), Tage (Wochentage, Übungen mit Sätzen/Wdh.-Ziel/optional „ab“/Zielgewicht/Pause/RPE/RIR/Notiz; optional Einheiten `groups` {Name, Durchgänge, Pause nach Durchgang} – Übungen einer Einheit tragen `groupId`, stehen hintereinander, Sätze = Durchgänge) |
| workouts | id, date, planId, startedAt | Abgeschlossene Workouts (Snapshot), Dauer, Körpergewicht, geschätzte kcal + optionaler Override; Übungen aus Einheiten tragen `group` (Satz i = Durchgang i) |
| activeWorkout | id (= "current") | Laufendes Workout inkl. Pausentimer-Zustand – übersteht Reload |
| cardio | id, date, startedAt | Ausdauer: Sportart, Dauer, Distanz, HF, RPE, geschätzte kcal + Override |
| water | id, date | Trinkeinträge (ml) |
| recovery | id (= Datum), date | Schlafdauer, Schlafqualität, Muskelkater, Energie (1–5) |
| savedMeals | id, name | Gespeicherte Mahlzeiten (Snapshot der Einträge) |
| mealPlan | id, date | Wochenplanung (Rezept + Portionen) |
| shopping | id, checked | Einkaufsliste |
| settings | key | Theme, Trinkziel, eigene Mahlzeiten, USDA-Key, Zustimmung Online-Suche, `lastBackupAt`, `backupSnoozeUntil`, `lookSeen`, `armorLoot` (Rüstungs-Beute), `setBonusLog` ([{from, setIdx}]), `worldLog` (Weltkarte: init/move/fight/chest/siege mit Datum, AP, Ergebnis, Beute), `apAck`, `sickDays` (Krankentage YYYY-MM-DD); `hero.armorHidden`, `hero.armorColor`; Rüstungskäufe als `armor-NN-slot` und Waffenkäufe als `waffe-<art>-NN` in `purchases` (Waffen-Beute ebenfalls in `armorLoot`; alte Käufe `item-…` werden mit 0 Denaren gewertet = erstattet); `hero.loadout.main/off` = Waffen-IDs, `hero.armorHidden` kann auch `main`/`off` enthalten; `hero.loadout` mit Slot `chest`; `hero.look` = { hair, beard, scar, tattoo, eyes, hairColor, beardColor } |
| apiCache | key, provider, expiresAt | Cache externer Antworten (nicht im Backup) |

## Konventionen
- Kalendertage als lokale `YYYY-MM-DD`-Strings; Zeitpunkte als ISO-8601.
- Unbekannte Nährwerte sind `null` (nie 0). Fehlende Tage existieren nicht (keine Platzhalterdatensätze).

## Migrationen
- **v1 → v2:** neue Tabellen recovery/savedMeals/mealPlan/shopping; Index `measurements.bodyFatMethod`; Umbenennung `bodyFatSource` → `bodyFatMethod` (`measured`→`manual`); fehlendes `updatedAt` ergänzt. Getestet in `tests/integration/persistence.test.ts`.
- Backups älterer Schemaversionen werden beim Import analog migriert; neuere Versionen werden abgelehnt.

## Backup-Format
```json
{ "app": "fitcore", "schemaVersion": 2, "exportedAt": "ISO", "tables": { "<tabelle>": [ … ] } }
```
