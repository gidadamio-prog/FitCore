// Echter Integrationstest gegen die dokumentierte Open-Food-Facts-API (AK-017).
// Ausführen mit: npm run test:off-live   (benötigt Internetzugang; respektiert die OFF-Ratenlimits: 2 Anfragen)
import { describe, expect, it } from 'vitest';
import { FitCoreDB, setDatabase } from '@/data/db';
import { openFoodFacts, setFetch } from '@/data/foodProviders';

describe('Open Food Facts – Live', () => {
  it('liefert echte Produktdaten per Barcode und Suche', async () => {
    const d = new FitCoreDB('live-' + Date.now());
    setDatabase(d);
    await d.open();
    setFetch((url, init) => fetch(url, { ...init, headers: { ...(init?.headers ?? {}), 'User-Agent': 'FitCore/1.0 (fitcore-local@example.invalid)' } }));
    const p = await openFoodFacts.byBarcode!('3017624010701');
    expect(p?.name.toLowerCase()).toContain('nutella');
    expect(p?.per100.kcal).toBeGreaterThan(400);
    const r = await openFoodFacts.search('haferflocken');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]!.source).toBe('off');
  }, 30000);
});
