import { beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDb } from './helpers';
import { cached, fetchJson, lookupBarcode, normalizeOff, normalizeUsda, openFoodFacts, ProviderError, RateLimiter, setFetch, setUsdaKeyProvider, usdaFoodData, dedupe, sortGermanFirst } from '@/data/foodProviders';
import { db } from '@/data/db';
import { createCustomFood } from '@/data/nutritionRepo';

// Kontrolliert simulierte Antworten im Format der dokumentierten OFF-/USDA-APIs.
const nutella = {
  code: '3017624010701', product_name: 'Nutella', brands: 'Ferrero,Nutella', quantity: '400 g', serving_size: '15 g', serving_quantity: 15,
  nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, sugars_100g: 56.3, salt_100g: 0.107, 'saturated-fat_100g': 10.6 },
  image_front_small_url: 'https://images.openfoodfacts.org/x.jpg',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(async () => {
  await freshDb();
});

describe('Open-Food-Facts-Adapter (AK-018/021/022/025–028)', () => {
  it('normalisiert Nährwerte korrekt mit Quelle und Lizenz', () => {
    const f = normalizeOff(nutella)!;
    expect(f.id).toBe('off:3017624010701');
    expect(f.per100).toMatchObject({ kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9 });
    expect(f.servings[0]!.grams).toBe(15);
    expect(f.brand).toBe('Ferrero');
    expect(f.sourceUrl).toContain('openfoodfacts.org/product/3017624010701');
    expect(f.license).toMatch(/ODbL/);
  });
  it('kJ → kcal, Natrium → Salz, fehlende Werte bleiben unbekannt', () => {
    const f = normalizeOff({ code: '123456789', product_name: 'Saft', quantity: '1 l', nutriments: { 'energy-kj_100g': 180, sodium_100g: 0.01, carbohydrates_100g: 10 } })!;
    expect(f.per100.kcal).toBe(43);
    expect(f.per100.salt).toBe(0.03);
    expect(f.per100.protein).toBeNull();
    expect(f.per100.fat).toBeNull();
    expect(f.unitBase).toBe('ml');
    expect(normalizeOff({ code: '1', nutriments: {} })).toBeNull();
  });
  it('Barcode-Abruf, Cache und unbekanntes Produkt', async () => {
    const fetchMock = vi.fn(async (url: string) => (url.includes('3017624010701') ? json({ status: 1, product: nutella }) : json({ status: 0, status_verbose: 'product not found' })));
    setFetch(fetchMock);
    const r = await lookupBarcode('3017624010701');
    expect(r.origin).toBe('off');
    expect(r.food!.name).toBe('Nutella');
    await openFoodFacts.byBarcode!('3017624010701');
    expect(fetchMock).toHaveBeenCalledTimes(1); // AK-027 Cache
    expect((await lookupBarcode('4000000000000')).food).toBeNull();
    await expect(openFoodFacts.byBarcode!('12')).rejects.toBeInstanceOf(ProviderError);
  });
  it('lokales Produkt mit Barcode wird offline gefunden', async () => {
    setFetch(async () => { throw new TypeError('offline'); });
    await createCustomFood({ name: 'Eigenes', barcode: '4012345678901', unitBase: 'g', kcal: 100, protein: 1, carbs: 1, fat: 1 });
    expect((await lookupBarcode('4012345678901')).origin).toBe('local');
  });
  it('Suche, Deduplizierung, Mindestlänge', async () => {
    const fetchMock = vi.fn(async () => json({ products: [nutella, nutella, { code: '9', product_name: '' }] }));
    setFetch(fetchMock);
    expect(await openFoodFacts.search('nu')).toEqual([]);
    const r = await openFoodFacts.search('nutella');
    expect(r).toHaveLength(1);
    await openFoodFacts.search('Nutella ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toMatch(/cgi\/search\.pl\?search_terms=nutella/);
  });
  it('AK-026: Netzwerkfehler, HTTP-Fehler, Rate-Limit und Timeout → ProviderError', async () => {
    setFetch(async () => { throw new TypeError('Failed to fetch'); });
    await expect(openFoodFacts.search('apfel')).rejects.toMatchObject({ kind: 'network' });
    setFetch(async () => json({}, 500));
    await expect(openFoodFacts.search('birne')).rejects.toMatchObject({ kind: 'http' });
    setFetch(async () => json({}, 429));
    await expect(openFoodFacts.search('kiwi')).rejects.toMatchObject({ kind: 'rate_limit' });
    setFetch((_u, init) => new Promise((_r, rej) => init!.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))));
    await expect(fetchJson('https://x.test', undefined, 20)).rejects.toMatchObject({ kind: 'timeout' });
    setFetch(async () => new Response('<html>', { status: 200 }));
    await expect(openFoodFacts.search('mango')).rejects.toMatchObject({ kind: 'parse' });
  });
  it('abgelaufener Cache dient als Offline-Fallback; Cache verfällt', async () => {
    let calls = 0;
    await cached('k', 'off', 1, async () => { calls++; return [1]; });
    await new Promise((r) => setTimeout(r, 5));
    const r = await cached('k', 'off', 1000, async () => { throw new ProviderError('x', 'network'); });
    expect(r).toEqual({ data: [1], fromCache: true });
    await cached('k', 'off', 1000, async () => { calls++; return [2]; });
    expect(calls).toBe(2);
    expect((await db.apiCache.get('k'))!.data).toEqual([2]);
  });
  it('Ratenbegrenzer', () => {
    const l = new RateLimiter(2, 1000);
    expect([l.tryAcquire(0), l.tryAcquire(1), l.tryAcquire(2), l.tryAcquire(1001)]).toEqual([true, true, false, true]);
  });
});

describe('USDA-Adapter', () => {
  const usdaFood = { fdcId: 171705, description: 'APPLES, RAW, WITH SKIN', dataType: 'SR Legacy', foodNutrients: [
    { nutrientId: 1008, nutrientNumber: '208', unitName: 'KCAL', value: 52 }, { nutrientId: 1003, unitName: 'G', value: 0.26 },
    { nutrientId: 1005, unitName: 'G', value: 13.8 }, { nutrientId: 1004, unitName: 'G', value: 0.17 }, { nutrientId: 1093, unitName: 'MG', value: 1 },
  ] };
  it('ohne API-Key: klare Konfigurationsmeldung, kein Request', async () => {
    setUsdaKeyProvider(() => '');
    const f = vi.fn();
    setFetch(f);
    expect(usdaFoodData.isConfigured()).toBe(false);
    await expect(usdaFoodData.search('apple')).rejects.toMatchObject({ kind: 'config' });
    expect(f).not.toHaveBeenCalled();
  });
  it('normalisiert USDA-Daten', async () => {
    setUsdaKeyProvider(() => 'TESTKEY');
    setFetch(async () => json({ foods: [usdaFood] }));
    const r = await usdaFoodData.search('apple');
    expect(r[0]!.per100).toMatchObject({ kcal: 52, protein: 0.26, carbs: 13.8, fat: 0.17, salt: 0 });
    expect(r[0]!.source).toBe('usda');
    expect(normalizeUsda({ fdcId: 1, description: 'X', foodNutrients: [] })!.per100.kcal).toBeNull();
  });
  it('dedupe über Barcode', () => {
    const a = normalizeOff(nutella)!;
    expect(dedupe([a, { ...a, id: 'usda:1' }])).toHaveLength(1);
  });
});

describe('Deutscher Markt & unvollständige Produkte', () => {
  it('sortiert in DE verkaufte, vollständige Produkte nach oben, ohne etwas zu entfernen', () => {
    const fr = { code: '1', product_name: 'FR', countries_tags: ['en:france'], nutriments: nutella.nutriments };
    const deEmpty = { code: '2', product_name: 'DE leer', countries_tags: ['en:germany'], nutriments: {} };
    const deFull = { code: '3', product_name: 'DE voll', countries_tags: ['en:germany'], nutriments: nutella.nutriments };
    expect(sortGermanFirst([fr, deEmpty, deFull]).map((p) => p.code)).toEqual(['3', '2', '1']);
  });
  it('Barcode: selbst ergänzter Eintrag hat Vorrang vor unvollständigem OFF-Import', async () => {
    const { upsertFood, createCustomFood } = await import('@/data/nutritionRepo');
    const offEmpty = normalizeOff({ code: '4067796185676', product_name: 'Apfelchips', brands: 'dmBio', nutriments: {} })!;
    expect(offEmpty.per100.kcal).toBeNull();
    await upsertFood(offEmpty);
    setFetch(async () => { throw new TypeError('offline'); });
    expect((await lookupBarcode('4067796185676')).food!.source).toBe('off');
    await createCustomFood({ name: 'Apfelchips', brand: 'dmBio', barcode: '4067796185676', unitBase: 'g', kcal: 349, protein: 2.7, carbs: 74, fat: 0.8 });
    const r = await lookupBarcode('4067796185676');
    expect(r.food!.source).toBe('custom');
    expect(r.food!.per100.kcal).toBe(349);
  });
});
