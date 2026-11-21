import { expect, type Page } from '@playwright/test';

export const year30 = `${new Date().getFullYear() - 30}-01-01`;

/** Onboarding über die echte UI: 80 kg, 180 cm, 30 J., männlich, leicht aktiv, Abnehmen (Standardrate). */
export async function onboard(page: Page, name = 'Giuliano') {
  await page.goto('/');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Geburtsdatum').fill(year30);
  await page.getByLabel(/Geschlecht/).selectOption('male');
  await page.getByLabel('Größe (cm)').fill('180');
  await page.getByLabel('Gewicht (kg)').fill('80');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByTestId('goal-preview')).toBeVisible();
  await page.getByRole('button', { name: 'Profil anlegen' }).click();
  await expect(page.getByTestId('remaining-kcal')).toBeVisible();
}

export const nutella = {
  code: '3017624010701',
  product_name: 'Nutella',
  brands: 'Ferrero',
  quantity: '400 g',
  serving_size: '15 g',
  serving_quantity: 15,
  nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, sugars_100g: 56.3, salt_100g: 0.107 },
};

/** Simuliert die dokumentierte Open-Food-Facts-API (Suche + Produkt). */
export async function mockOff(page: Page) {
  await page.route('https://world.openfoodfacts.org/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/cgi/search.pl')) return route.fulfill({ json: { count: 1, products: [nutella] } });
    if (url.includes('/api/v2/product/3017624010701')) return route.fulfill({ json: { status: 1, product: nutella } });
    if (url.includes('/api/v2/product/')) return route.fulfill({ json: { status: 0, status_verbose: 'product not found' } });
    return route.fulfill({ status: 404, body: '' });
  });
}

export async function nav(page: Page, label: 'Heute' | 'Ernährung' | 'Training' | 'Körper' | 'Statistiken') {
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: label }).click();
}

export async function createCustomFood(page: Page, name: string, kcal: number, p: number, c: number, f: number) {
  await nav(page, 'Ernährung');
  await page.getByRole('tab', { name: 'Lebensmittel' }).click();
  await page.getByRole('button', { name: 'Eigenes Lebensmittel' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Name', { exact: true }).fill(name);
  await dlg.getByLabel('Kalorien (kcal)').fill(String(kcal));
  await dlg.getByLabel('Protein (g)').fill(String(p));
  await dlg.getByLabel('Kohlenhydrate (g)').fill(String(c));
  await dlg.getByLabel('Fett (g)').fill(String(f));
  await dlg.getByRole('button', { name: /Speichern/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export async function createAndActivatePlan(page: Page) {
  await nav(page, 'Training');
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByLabel('Planname').fill('PPL Push');
  const wd = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date().getDay()]!;
  await page.getByRole('button', { name: wd, exact: true }).click();
  for (const q of ['Bankdrücken (Langhantel)', 'Schulterdrücken (Kurzhantel)']) {
    await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
    await page.getByRole('dialog').getByLabel('Übung suchen').fill(q.split(' ')[0]!);
    await page.getByRole('dialog').getByRole('button', { name: new RegExp('^' + q.replace(/[()]/g, '\\$&')) }).click();
  }
  const ex = page.getByTestId('plan-exercise');
  await expect(ex).toHaveCount(2);
  await ex.nth(0).getByLabel('Zielgew. kg').fill('60');
  await ex.nth(0).getByLabel('Wdh. min').fill('8');
  await ex.nth(0).getByLabel('Wdh. max').fill('10');
  await page.getByRole('button', { name: 'Speichern & aktivieren' }).click();
  await expect(page.getByTestId('plan-card').first()).toContainText('aktiv');
}

/** Schließt eventuell angezeigte Feier-Dialoge (Bestleistung, Abzeichen, Rang). */
export async function dismissCelebrations(page: Page) {
  for (let i = 0; i < 10; i++) {
    const btn = page.getByRole('button', { name: /^(Ave!|Weiter)$/ });
    try {
      await btn.first().waitFor({ state: 'visible', timeout: 1200 });
    } catch {
      return;
    }
    await btn.first().click();
  }
}
