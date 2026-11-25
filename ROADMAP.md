# Roadmap / offene Aufgaben (priorisiert)

1. **Release-Blocker AK-017:** `npm run test:off-live` mit Internetzugang ausführen; CORS der OFF-Endpunkte im Browser bestätigen. Bei Fehlschlag: Proxy über `setFetch()`.
2. **AK-028:** kleiner Server-/Edge-Proxy für Open Food Facts (setzt `User-Agent: FitCore/1.0 (Kontakt)`, kann auch den USDA-Schlüssel serverseitig halten).
3. Umstieg Barcode-Abruf auf OFF API v3 (v2 ist laut Doku veraltet); Suche auf Search-a-licious, sobald verfügbar.
4. Manuelle Geräteprüfung: Kamerascanner (nativer BarcodeDetector) auf Android/iOS, PWA-Installation, Offline-Start.
5. Fortschrittsfotos mit Vergleichsansicht (lokal, optional verschlüsselt).
6. Erinnerungen (Notification API / Periodic Sync, wo verfügbar).
7. RPE-Eingabe im Plan-Editor und Live-Workout pro Satz (Datenmodell vorhanden).
8. Übungs-Demonstrationsmedien.
9. Code-Splitting der Seiten (Bundle derzeit ~1,1 MB unkomprimiert / ~350 kB gzip über mehrere Chunks).
10. Optional: Cloud-Sync (Supabase) mit Ende-zu-Ende-Zustimmung; native Hülle (Capacitor) für Health Connect/HealthKit.
11. Update-Idee: weibliche Grundkörper (eigene 12 Bilder; Fettgrenzen sind bereits um +9 Punkte verschoben hinterlegt).
12. Optional: Backup vollautomatisch in OneDrive (Microsoft Graph + MSAL, Scope `Files.ReadWrite.AppFolder`) – braucht eine eigene App-Registrierung in Microsoft Entra (Client-ID, Redirect-URI = GitHub-Pages-URL).
13. Ganzkörper-Held: Frisuren/Bärte (1.17.0), Tattoos/Narben/Brillen (1.18.0) sind drin; Rüstung (36 Sets, 1.20.0) ist drin; danach Waffen/Schilde (Handanker je Körper) und Rüstung (4 Silhouettenklassen) und eine Anpassen-Seite.
14. Weltkarte Phase 2: Kampfwerte je Teil mit Aufwertung +0 … +10 (Schmiede), Materialien Eisen/Silber/Gold/Reliquien, Drop-Tabellen je Region und Aktion mit Pech-Sicherung, Zerlegen, AP-Set-Boni (z. B. +1 AP je Wochen-Feldzug).
15. Weltkarte Phase 3: Story-Kapitel je Region (Szenen mit Porträt), Prolog als Einstieg, Dashboard „Lager“; danach Endlos-Modus.
16. Startseite als „Lager“-Szene mit dem Helden im Fokus; Bereiche (Essen, Training, Körper …) als Bildszenen statt Kacheln, Hintergründe aufwertbar.

