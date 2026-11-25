import { expect, test } from '@playwright/test';
import { dismissCelebrations, onboard } from './helpers';

test('AK-116 Inventar: Sammlung mit Zählern, Filter, Details, fehlende Teile mit Weg, Anlegen', async ({ page }) => {
  await onboard(page);
  await page.getByTestId('today-hero').click();
  const form = page.getByTestId('hero-form');
  await form.getByLabel('Name des Helden').fill('Maximus');
  await form.getByRole('radio', { name: /Legionär/ }).click();
  await form.getByRole('button', { name: 'Schild' }).click();
  await form.getByRole('button', { name: 'Held erschaffen' }).click();
  await dismissCelebrations(page);

  // vom Charakterbogen ins Inventar
  await page.getByTestId('open-inventory').click();
  const tab = page.getByTestId('inventory-tab');
  await expect(tab.getByTestId('inv-count-weapons')).toHaveText('2/100');
  await expect(tab.getByTestId('inv-count-armor')).toHaveText('5/180'); // Novizen-Set inkl. Kapuze
  await expect(tab.getByTestId('inv-count-sets')).toHaveText('1/36');
  await expect(tab.getByTestId('inv-grid').locator('li')).toHaveCount(7);

  // Filter Waffen → Nebenhand
  await tab.getByRole('tab', { name: 'Waffen' }).click();
  await expect(tab.getByTestId('inv-grid').locator('li')).toHaveCount(2);
  await tab.getByRole('button', { name: 'Nebenhand' }).click();
  await expect(tab.getByTestId('inv-grid').locator('li')).toHaveCount(1);
  await tab.getByTestId('inv-tile-waffe-schild-00').click();
  await expect(page.getByTestId('item-sheet')).toContainText('Schild I');
  await expect(page.getByTestId('item-stats')).toContainText('Abwehr +4');
  await expect(page.getByTestId('item-sheet')).toContainText('angelegt');
  await page.keyboard.press('Escape');

  // fehlende zeigen: Weg zur Freischaltung
  await tab.getByTestId('inv-show-locked').check();
  await tab.getByTestId('inv-tile-waffe-schild-09').click();
  await expect(page.getByTestId('item-sheet')).toContainText('So bekommst du es: Beute ab');
  await page.keyboard.press('Escape');

  // Rüstung: Kapuze anlegen
  await tab.getByTestId('inv-show-locked').uncheck();
  await tab.getByRole('tab', { name: 'Rüstung' }).click();
  await tab.getByTestId('inv-tile-armor-00-head').click();
  await expect(page.getByTestId('item-sheet')).toContainText('Set Novize: 5/5 Teile');
  await page.getByTestId('item-equip').click();
  await expect(tab.getByTestId('inv-tile-armor-00-head')).toHaveAccessibleName(/angelegt/);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/inventar.png' });
});
