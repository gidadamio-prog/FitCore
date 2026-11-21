// Externe Lebensmitteldatenbanken hinter einer gemeinsamen Provider-Schnittstelle.
// Es werden ausschließlich Suchbegriffe bzw. Barcodes übertragen – niemals Körper- oder Gesundheitsdaten.
import { db } from './db';
import type { FoodItem, Nutrients } from '@/domain/types';
import { completeness, kcalFromMacros, parseServingSize, saltFromSodium, toKcal } from '@/domain/nutrition';
import { nowISO } from '@/domain/dates';

export class ProviderError extends Error {
  constructor(
    message: string,
    public kind: 'network' | 'timeout' | 'http' | 'rate_limit' | 'config' | 'parse',
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface FoodProvider {
  id: 'off' | 'usda';
  label: string;
  attribution: string;
  isConfigured(): boolean;
  search(query: string, signal?: AbortSignal): Promise<FoodItem[]>;
  byBarcode?(code: string, signal?: AbortSignal): Promise<FoodItem | null>;
}

// ---------- HTTP-Hilfen ----------

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
let fetchImpl: FetchLike = (i, init) => fetch(i, init);
export function setFetch(f: FetchLike) {
  fetchImpl = f;
}

export const TIMEOUT_MS = 10000;

export async function fetchJson(url: string, signal?: AbortSignal, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  const onAbort = () => ctrl.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort);
  try {
    let res: Response;
    try {
      res = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    } catch (e) {
      if (signal?.aborted) throw e;
      if (ctrl.signal.aborted) throw new ProviderError('Zeitüberschreitung bei der Anfrage. Bitte später erneut versuchen.', 'timeout');
      throw new ProviderError('Keine Verbindung zur Lebensmitteldatenbank. Lokale Lebensmittel sind weiterhin verfügbar.', 'network');
    }
    if (res.status === 429 || res.status === 503) throw new ProviderError('Der Anbieter begrenzt gerade Anfragen. Bitte kurz warten.', 'rate_limit');
    if (res.status === 404) return null;
    if (!res.ok) throw new ProviderError(`Anbieter antwortet mit Fehler ${res.status}.`, 'http');
    try {
      return await res.json();
    } catch {
      throw new ProviderError('Antwort des Anbieters konnte nicht gelesen werden.', 'parse');
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// ---------- Cache ----------

export const SEARCH_TTL = 24 * 3600 * 1000; // 24 h
export const PRODUCT_TTL = 7 * 24 * 3600 * 1000; // 7 Tage
export const NOT_FOUND_TTL = 6 * 3600 * 1000; // 6 h

export async function cached<T>(key: string, provider: string, ttl: number, load: () => Promise<T>): Promise<{ data: T; fromCache: boolean }> {
  const hit = await db.apiCache.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return { data: hit.data as T, fromCache: true };
  try {
    const data = await load();
    await db.apiCache.put({ key, provider, data, fetchedAt: now, expiresAt: now + (data == null ? NOT_FOUND_TTL : ttl) });
    return { data, fromCache: false };
  } catch (e) {
    // Bei Netzwerkfehler abgelaufenen Cache als Fallback verwenden
    if (hit && e instanceof ProviderError && (e.kind === 'network' || e.kind === 'timeout')) return { data: hit.data as T, fromCache: true };
    throw e;
  }
}

/** Einfacher clientseitiger Ratenbegrenzer (gleitendes Fenster). */
export class RateLimiter {
  private stamps: number[] = [];
  constructor(
    private max: number,
    private windowMs: number,
  ) {}
  tryAcquire(now = Date.now()): boolean {
    this.stamps = this.stamps.filter((t) => now - t < this.windowMs);
    if (this.stamps.length >= this.max) return false;
    this.stamps.push(now);
    return true;
  }
}

// ---------- Open Food Facts ----------

const OFF_BASE = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'code,product_name,product_name_de,generic_name,brands,nutriments,serving_size,serving_quantity,quantity,product_quantity_unit,image_front_small_url,image_url,nutrition_data_per,countries_tags';
const APP_PARAMS = `app_name=FitCore&app_version=1.0`;
const offSearchLimiter = new RateLimiter(8, 60000); // OFF: max. 10 Suchanfragen/min
const offProductLimiter = new RateLimiter(12, 60000); // OFF: max. 15 Produktabrufe/min

type OffNutriments = Record<string, number | string | undefined>;
interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  generic_name?: string;
  brands?: string;
  nutriments?: OffNutriments;
  serving_size?: string;
  serving_quantity?: number | string;
  quantity?: string;
  product_quantity_unit?: string;
  image_front_small_url?: string;
  image_url?: string;
  countries_tags?: string[];
}

const numOrNull = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function normalizeOff(p: OffProduct): FoodItem | null {
  const code = p.code?.trim();
  const name = (p.product_name_de || p.product_name || p.generic_name || '').trim();
  if (!code || !name) return null;
  const n = p.nutriments ?? {};
  const g = (k: string) => numOrNull(n[`${k}_100g`]);
  let kcal = g('energy-kcal');
  let kcalOrigin: FoodItem['kcalOrigin'] = kcal != null ? 'label' : 'unknown';
  if (kcal == null) {
    const kj = g('energy-kj') ?? (n['energy_unit'] === 'kJ' ? g('energy') : null);
    if (kj != null) {
      kcal = Math.round(toKcal(kj, 'kJ'));
      kcalOrigin = 'label';
    }
  }
  const sodium = g('sodium');
  const per100: Nutrients = {
    kcal: kcal != null ? Math.round(kcal * 10) / 10 : null,
    protein: g('proteins'),
    carbs: g('carbohydrates'),
    fat: g('fat'),
    fiber: g('fiber'),
    sugar: g('sugars'),
    salt: g('salt') ?? (sodium != null ? saltFromSodium(sodium) : null),
    satFat: g('saturated-fat'),
  };
  if (per100.kcal == null && kcalFromMacros(per100) != null) {
    // kcal fehlen auf dem Etikett → NICHT stillschweigend ergänzen; Herkunft markieren, Wert bleibt null.
    kcalOrigin = 'unknown';
  }
  const isMl = p.product_quantity_unit === 'ml' || /\d\s*(ml|cl|l)\b/i.test(p.quantity ?? '') || /\d\s*ml\b/i.test(p.serving_size ?? '');
  const servingQ = numOrNull(p.serving_quantity) ?? parseServingSize(p.serving_size);
  return {
    id: 'off:' + code,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    barcode: code,
    source: 'off',
    sourceId: code,
    sourceUrl: `${OFF_BASE}/product/${code}`,
    license: 'Open Food Facts – ODbL 1.0 (Daten), CC BY-SA 3.0 (Bilder)',
    unitBase: isMl ? 'ml' : 'g',
    per100,
    kcalOrigin,
    servings: servingQ ? [{ label: p.serving_size || `${servingQ} ${isMl ? 'ml' : 'g'}`, grams: servingQ }] : [],
    imageUrl: p.image_front_small_url || p.image_url,
    favorite: 0,
    useCount: 0,
    fetchedAt: nowISO(),
    createdAt: nowISO(),
  };
}

/** Deutscher Markt zuerst: in Deutschland verkaufte Produkte mit vollständigen Nährwerten oben. Nichts wird entfernt. */
export function sortGermanFirst(products: OffProduct[]): OffProduct[] {
  const score = (p: OffProduct) => {
    const de = p.countries_tags?.some((t) => t === 'en:germany' || t === 'en:austria' || t === 'en:switzerland') ? 0 : 2;
    const n = p.nutriments ?? {};
    const complete = ['energy-kcal_100g', 'proteins_100g', 'carbohydrates_100g', 'fat_100g'].every((k) => n[k] != null) ? 0 : 1;
    return de + complete;
  };
  return products.map((p, i) => ({ p, i, s: score(p) })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.p);
}

/** Link zum Ergänzen eines Produkts bei Open Food Facts (Community-Datenbank). */
export const offEditUrl = (code: string) => `${OFF_BASE}/cgi/product.pl?type=edit&code=${encodeURIComponent(code)}`;

export const openFoodFacts: FoodProvider = {
  id: 'off',
  label: 'Open Food Facts',
  attribution: 'Daten von Open Food Facts (openfoodfacts.org), lizenziert unter ODbL 1.0. Angaben ohne Gewähr.',
  isConfigured: () => true,
  async search(query, signal) {
    const q = query.trim();
    if (q.length < 3) return [];
    const key = 'off:search:' + q.toLowerCase();
    const { data } = await cached(key, 'off', SEARCH_TTL, async () => {
      if (!offSearchLimiter.tryAcquire()) throw new ProviderError('Suchlimit von Open Food Facts erreicht (10/min). Bitte kurz warten.', 'rate_limit');
      const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&fields=${OFF_FIELDS}&lc=de&${APP_PARAMS}`;
      const json = (await fetchJson(url, signal)) as { products?: OffProduct[] } | null;
      return sortGermanFirst(json?.products ?? [])
        .map(normalizeOff)
        .filter((x): x is FoodItem => x != null);
    });
    return dedupe(data);
  },
  async byBarcode(code, signal) {
    const c = code.replace(/\D/g, '');
    if (c.length < 8 || c.length > 14) throw new ProviderError('Ungültiger Barcode (8–14 Ziffern).', 'parse');
    const { data } = await cached('off:product:' + c, 'off', PRODUCT_TTL, async () => {
      if (!offProductLimiter.tryAcquire()) throw new ProviderError('Abruflimit von Open Food Facts erreicht. Bitte kurz warten.', 'rate_limit');
      const url = `${OFF_BASE}/api/v2/product/${c}.json?fields=${OFF_FIELDS}&lc=de&${APP_PARAMS}`;
      const json = (await fetchJson(url, signal)) as { status?: number | string; product?: OffProduct } | null;
      if (!json || !json.product || json.status === 0 || json.status === 'failure') return null;
      return normalizeOff({ ...json.product, code: json.product.code ?? c });
    });
    return data;
  },
};

// ---------- USDA FoodData Central ----------

let usdaKeyProvider: () => string = () => (import.meta.env?.VITE_USDA_API_KEY as string | undefined) ?? '';
export function setUsdaKeyProvider(f: () => string) {
  usdaKeyProvider = f;
}

interface UsdaNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}
interface UsdaFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  gtinUpc?: string;
  foodNutrients?: UsdaNutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
}

export function normalizeUsda(f: UsdaFood): FoodItem | null {
  if (!f.fdcId || !f.description) return null;
  const list = f.foodNutrients ?? [];
  const find = (ids: number[], nums: string[], unit?: string) => {
    const hit = list.find((n) => (ids.includes(n.nutrientId ?? -1) || nums.includes(n.nutrientNumber ?? '')) && (!unit || n.unitName?.toUpperCase() === unit));
    return hit?.value != null && Number.isFinite(hit.value) ? hit.value : null;
  };
  let kcal = find([1008, 2047, 2048], ['208', '957', '958'], 'KCAL');
  if (kcal == null) {
    const kj = find([1062], ['268'], 'KJ');
    if (kj != null) kcal = Math.round(toKcal(kj, 'kJ'));
  }
  const sodiumMg = find([1093], ['307']);
  // Branded-Foods werden pro 100 g geliefert (labelNutrients separat); Foundation/SR Legacy ebenfalls pro 100 g.
  const per100: Nutrients = {
    kcal,
    protein: find([1003], ['203']),
    carbs: find([1005], ['205']),
    fat: find([1004], ['204']),
    fiber: find([1079], ['291']),
    sugar: find([2000, 1063], ['269']),
    salt: sodiumMg != null ? saltFromSodium(sodiumMg / 1000) : null,
    satFat: find([1258], ['606']),
  };
  return {
    id: 'usda:' + f.fdcId,
    name: f.description.charAt(0) + f.description.slice(1).toLowerCase(),
    brand: f.brandOwner,
    barcode: f.gtinUpc,
    source: 'usda',
    sourceId: String(f.fdcId),
    sourceUrl: `https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`,
    license: 'USDA FoodData Central – gemeinfrei (CC0 1.0)',
    unitBase: f.servingSizeUnit?.toLowerCase() === 'ml' ? 'ml' : 'g',
    per100,
    kcalOrigin: kcal != null ? 'label' : 'unknown',
    servings: f.servingSize && f.servingSizeUnit && /^(g|ml)$/i.test(f.servingSizeUnit) ? [{ label: `${f.servingSize} ${f.servingSizeUnit.toLowerCase()}`, grams: f.servingSize }] : [],
    favorite: 0,
    useCount: 0,
    fetchedAt: nowISO(),
    createdAt: nowISO(),
  };
}

export const usdaFoodData: FoodProvider = {
  id: 'usda',
  label: 'USDA FoodData Central',
  attribution: 'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central (fdc.nal.usda.gov), CC0 1.0.',
  isConfigured: () => !!usdaKeyProvider(),
  async search(query, signal) {
    const key = usdaKeyProvider();
    if (!key) throw new ProviderError('Für USDA FoodData Central ist ein eigener API-Schlüssel nötig (Einstellungen → Datenquellen).', 'config');
    const q = query.trim();
    if (q.length < 3) return [];
    const { data } = await cached('usda:search:' + q.toLowerCase(), 'usda', SEARCH_TTL, async () => {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&dataType=${encodeURIComponent('Foundation,SR Legacy')}&pageSize=20`;
      const json = (await fetchJson(url, signal)) as { foods?: UsdaFood[] } | null;
      return (json?.foods ?? []).map(normalizeUsda).filter((x): x is FoodItem => x != null);
    });
    return dedupe(data);
  },
};

export const PROVIDERS: FoodProvider[] = [openFoodFacts, usdaFoodData];

export function dedupe(list: FoodItem[]): FoodItem[] {
  const seen = new Set<string>();
  const out: FoodItem[] = [];
  for (const f of list) {
    const k = f.barcode ? 'bc:' + f.barcode : f.id;
    if (seen.has(k) || seen.has(f.id)) continue;
    seen.add(k);
    seen.add(f.id);
    out.push(f);
  }
  return out;
}

/** Barcode-Suche: zuerst lokal (offline), dann Open Food Facts. */
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<{ food: FoodItem | null; origin: 'local' | 'off' | 'none' }> {
  const c = code.replace(/\D/g, '');
  // Lokal zuerst; eigene (selbst ergänzte) Einträge haben Vorrang vor importierten, vollständige vor unvollständigen.
  const locals = await db.foods.where('barcode').equals(c).toArray();
  const rank = (f: FoodItem) => (f.source === 'custom' ? 0 : 2) + (completeness(f.per100) === 'complete' ? 0 : 1);
  const local = locals.sort((a, b) => rank(a) - rank(b))[0];
  if (local) return { food: local, origin: 'local' };
  const remote = await openFoodFacts.byBarcode!(c, signal);
  return remote ? { food: remote, origin: 'off' } : { food: null, origin: 'none' };
}
