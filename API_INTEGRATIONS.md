# Externe Integrationen

Gemeinsame Schnittstelle `FoodProvider` (`src/data/foodProviders.ts`): `search(query)`, optional `byBarcode(code)`, `isConfigured()`, `attribution`. Alle Antworten werden auf `FoodItem` normalisiert (Quelle, Lizenz, Quell-URL, `per100` mit `null` für Unbekanntes).

## Open Food Facts (primär)
- Doku: https://openfoodfacts.github.io/openfoodfacts-server/api/ (geprüft am 21.11.2026)
- **Barcode:** `GET https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=…` (API v2; laut Doku veraltet, aber unterstützt – Umstieg auf v3 siehe ROADMAP).
- **Suche:** `GET /cgi/search.pl?search_terms=…&search_simple=1&action=process&json=1&page_size=24&fields=…` (laut Doku einziger Volltext-Endpunkt; Search-a-licious noch nicht verfügbar).
- **Limits:** 15 Produktabrufe/min, 10 Suchen/min pro IP; keine Suche „as-you-type“. Umsetzung: lokale Treffer sofort, Online-Suche erst nach 800 ms Debounce und ≥ 3 Zeichen, clientseitiger Limiter (8 Suchen/12 Produkte pro Minute), Cache (Suche 24 h, Produkt 7 Tage, „nicht gefunden“ 6 h), abgelaufener Cache als Offline-Fallback.
- **Lizenz:** Datenbank ODbL 1.0, Inhalte DbCL, Bilder CC BY-SA 3.0 – Hinweis in Suche, Produktdetail und Einstellungen; Quell-Link je Produkt.
- **User-Agent:** OFF bittet um einen eigenen User-Agent. Browser verbieten das Setzen dieses Headers; FitCore sendet daher `app_name=FitCore&app_version=1.0`. Für volle Konformität einen kleinen Server-Proxy vorschalten (`setFetch()`).
- Fehlerbehandlung: Timeout 10 s, Netzwerk, HTTP 4xx/5xx, 429/503 (Rate-Limit), ungültiges JSON → verständliche Meldung, App bleibt nutzbar; unbekannte Produkte können selbst angelegt werden.
- Status: Adapter mit simulierten, dem dokumentierten Format entsprechenden Antworten getestet. **Live-Test vorhanden, konnte in der Entwicklungsumgebung nicht laufen (Netzwerk-Proxy blockiert openfoodfacts.org)** → `npm run test:off-live` bitte einmal mit Internet ausführen. CORS-Verhalten aus dem Browser wurde daher ebenfalls noch nicht live verifiziert.

## USDA FoodData Central (sekundär, optional)
- `GET https://api.nal.usda.gov/fdc/v1/foods/search?api_key=…&query=…&dataType=Foundation,SR Legacy&pageSize=20`
- Benötigt eigenen kostenlosen API-Schlüssel (https://fdc.nal.usda.gov/api-key-signup). Kein Schlüssel im Code; Eingabe lokal in den Einstellungen oder `VITE_USDA_API_KEY` für private Builds. Ohne Schlüssel: Hinweis, keine Anfrage.
- Nährstoffzuordnung über nutrientId/-number (Energie 1008/2047/2048 kcal bzw. 1062 kJ, Protein 1003, KH 1005, Fett 1004, Ballaststoffe 1079, Zucker 2000, Natrium 1093 → Salz, gesättigte FS 1258), Werte pro 100 g.
- Lizenz: gemeinfrei (CC0 1.0); Quellenangabe in den Einstellungen.
- Status: mit simulierten Antworten getestet, nicht live.

## Barcode-Scanner
- Native `BarcodeDetector` (EAN-13/8, UPC-A/E, Code 128/39, ITF), sonst `@zxing/browser`. Manuelle Eingabe immer verfügbar; Fehlerfälle: keine Kamera, verweigert, kein HTTPS.
- Getestet: ZXing-Pfad mit simulierter Kamera in Chrome (E2E). Auf echten Geräten bitte manuell prüfen.

## Nicht aktiv (vorbereitet)
- Android Health Connect / Apple HealthKit: nur nativ möglich – in der PWA ausdrücklich als „nicht aktiv“ gekennzeichnet.
- Cloud-Sync (z. B. Supabase) und KI-Assistenz: nicht implementiert; Datenmodell vorbereitet.
