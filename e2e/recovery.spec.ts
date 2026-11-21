import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('Hängender Start: nach 8 s Hilfe, Diagnose und Reparatur-Knöpfe statt Endlos-Ladebildschirm', async ({ page }) => {
  // IndexedDB „hängt“ (öffnet nie) – simuliert ein blockiertes Gerät
  await page.addInitScript(() => {
    const orig = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args: Parameters<typeof orig>) => {
      const req = orig(...args);
      Object.defineProperty(req, 'onsuccess', { set() {}, get() { return null; } });
      req.addEventListener = () => undefined;
      return req;
    };
  });
  await page.goto('/');
  await expect(page.getByText('Lade FitCore …')).toBeVisible();
  await expect(page.getByTestId('recovery')).toBeVisible({ timeout: 12000 });
  await expect(page.getByRole('button', { name: 'Neu laden' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'App-Update erzwingen (Daten bleiben)' })).toBeVisible();
  await expect(page.getByText(/Datenbank offen: nein/)).toBeVisible();
});

test('App-Update erzwingen behält alle Daten', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/settings');
  await page.getByRole('tab', { name: 'Daten' }).click();
  await page.getByRole('button', { name: 'App neu laden' }).click();
  await expect(page.getByRole('heading', { name: 'Einstellungen & Profil' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Giuliano'); // Daten erhalten
});
