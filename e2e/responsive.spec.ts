import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

const routes = ['/#/', '/#/nutrition', '/#/nutrition?tab=recipes', '/#/nutrition?tab=plan', '/#/training', '/#/training?tab=cardio', '/#/training?tab=exercises', '/#/body', '/#/stats', '/#/coach', '/#/settings'];

test('AK-004/088 Kein horizontales Scrollen, Hauptbereiche erreichbar, Touch-Ziele ≥ 40 px', async ({ page }) => {
  await onboard(page);
  for (const r of routes) {
    await page.goto(r);
    await page.waitForTimeout(250);
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(sw, `horizontales Scrollen auf ${r}`).toBeLessThanOrEqual(iw);
  }
  const mobile = (page.viewportSize()?.width ?? 1000) < 768;
  const navLinks = mobile ? page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link') : page.locator('aside a');
  const n = await navLinks.count();
  expect(n).toBeGreaterThanOrEqual(5);
  for (let i = 0; i < n; i++) {
    const box = await navLinks.nth(i).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(40);
  }
  // Dialog bleibt bedienbar
  await page.goto('/#/body');
  await page.getByRole('button', { name: 'Messung' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('button', { name: 'Speichern' })).toBeInViewport();
});

test('AK-087 Essen, Training, Gewicht mit ≤ 3 Interaktionen vom Dashboard', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Lebensmittel' }).first().click(); // 1
  await expect(page.getByRole('dialog').getByLabel('Lebensmittel suchen')).toBeVisible();
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Training starten' }).click(); // 1
  await expect(page.getByRole('button', { name: 'Training abschließen' })).toBeVisible();
  await page.getByRole('button', { name: 'Verwerfen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Verwerfen' }).click();
  await expect(page.getByRole('heading', { name: 'Training' })).toBeVisible();
  await page.locator('a[href="#/"]:visible').first().click();
  await page.getByRole('button', { name: 'Gewicht' }).click(); // 1
  await page.getByLabel('Gewicht heute (kg)').fill('79.8');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('79,8')).toBeVisible();
});
