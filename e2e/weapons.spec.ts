import { expect, test } from '@playwright/test';
import { dismissCelebrations, onboard } from './helpers';

test('AK-115 Waffen: Start-Waffen an der Figur, Inventar mit Werten und Freischaltwegen, ausblendbar, Markt', async ({ page }) => {
  await onboard(page);
  await page.getByTestId('today-hero').click();
  const form = page.getByTestId('hero-form');
  await form.getByLabel('Name des Helden').fill('Maximus');
  await form.getByRole('radio', { name: /Legionär/ }).click();
  await form.getByRole('button', { name: 'Schild' }).click();
  await form.getByRole('button', { name: 'Held erschaffen' }).click();
  await dismissCelebrations(page);
  const sheet = page.getByTestId('character-sheet');
  const fig = sheet.getByTestId('hero-figure');
  await expect(fig.getByTestId('weapon-main')).toBeVisible();
  await expect(fig.getByTestId('weapon-off')).toBeVisible();

  // Inventar: Werte, gesperrte Waffen mit Weg zur Freischaltung, Boss-Waffe
  await sheet.getByTestId('slot-main').click();
  await expect(page.getByTestId('weapon-line-waffe-schwert-00')).toContainText('Schwert I · Angriff +5');
  await page.getByTestId('inventory-locked').locator('summary').click();
  await expect(page.getByTestId('inv-waffe-schwert-09')).toContainText('Beute ab');
  await expect(page.getByTestId('inv-waffe-boss-08')).toContainText('Beute von');
  await page.keyboard.press('Escape');

  // Waffen ausblenden (bleiben angelegt)
  await sheet.getByTestId('armor-visibility').click();
  await page.getByTestId('vis-main').click();
  await page.keyboard.press('Escape');
  await expect(fig.getByTestId('weapon-main')).toHaveCount(0);
  await expect(sheet.getByTestId('slot-main')).toHaveAccessibleName(/Holzschwert/);
  await page.waitForTimeout(300);
  await sheet.screenshot({ path: 'test-results/waffen-sheet.png' });

  // Markt: Waffenarten, Stufe I sichtbar, Stufe II mit Rang-Hinweis
  await page.getByRole('tab', { name: 'Markt' }).click();
  const shop = page.getByTestId('weapon-shop');
  await shop.getByRole('tab', { name: 'Stangenwaffe' }).click();
  await expect(shop.getByTestId('shop-weapon-waffe-stangenwaffe-00')).toContainText('Zweihand');
  await expect(shop.getByTestId('shop-weapon-waffe-stangenwaffe-01')).toContainText('ab Rang');
});
