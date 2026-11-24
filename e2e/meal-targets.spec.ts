import { expect, test } from '@playwright/test';
import { mockOff, nav, onboard } from './helpers';

// Tagesziel nach Onboarding: 2.008 kcal. Standard 25/35/30/10 → 502 / 703 / 602 / 201 (Summe 2.008)
test('Kalorienziel je Mahlzeit: Aufteilung passt zum Tagesziel und offene Mahlzeiten passen sich an', async ({ page }) => {
  await mockOff(page);
  await onboard(page);
  await nav(page, 'Ernährung');
  await expect(page.getByTestId('meal-kcal-breakfast')).toHaveText('0 / 502 kcal');
  await expect(page.getByTestId('meal-kcal-lunch')).toHaveText('0 / 703 kcal');
  await expect(page.getByTestId('meal-kcal-dinner')).toHaveText('0 / 602 kcal');
  await expect(page.getByTestId('meal-kcal-snack')).toHaveText('0 / 201 kcal');
  await expect(page.getByTestId('meal-adjust-hint')).toHaveCount(0);

  // 100 g Nutella (539 kcal) zum Frühstück → 37 kcal drüber, innerhalb ±10 % = Punktlandung; Rest 1.469 kcal auf offene Mahlzeiten (35:30:10)
  await page.getByRole('button', { name: 'Frühstück: Lebensmittel hinzufügen' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Lebensmittel suchen').fill('nutella');
  await dlg.getByTestId('online-results').getByRole('button', { name: /Nutella/ }).click();
  await dlg.getByLabel('Einheit').selectOption('g');
  await dlg.getByLabel('Menge').fill('100');
  await dlg.getByRole('button', { name: 'Hinzufügen' }).click();
  await page.getByTestId('add-done').click();
  await expect(page.getByTestId('meal-kcal-breakfast')).toHaveText('539 / 502 kcal');
  await expect(page.getByTestId('meal-hit-breakfast')).toHaveText('Punktlandung ✓');
  await expect(page.getByTestId('meal-kcal-lunch')).toHaveText('0 / 685 kcal');
  await expect(page.getByTestId('meal-kcal-dinner')).toHaveText('0 / 588 kcal');
  await expect(page.getByTestId('meal-kcal-snack')).toHaveText('0 / 196 kcal');
  await expect(page.getByTestId('meal-target-lunch')).toContainText('geplant 703');
  await expect(page.getByTestId('meal-adjust-hint')).toBeVisible();

  // Einstellungen: Aufteilung ändern, Summenhinweis, Standard
  await page.goto('/#/settings');
  await page.getByRole('tab', { name: 'Ziele' }).click();
  const card = page.getByTestId('meal-split');
  await expect(card.getByTestId('split-kcal-breakfast')).toHaveText('502 kcal');
  await expect(card.getByTestId('split-sum')).toHaveText('Summe 100 %');
  await card.getByLabel('Anteil Frühstück in Prozent').fill('35');
  await expect(card.getByTestId('split-sum')).toContainText('Summe 110 %');
  await expect(card.getByTestId('split-sum')).toContainText('anteilig');
  // 2.008 × 35/110 = 638,9 → 639
  await expect(card.getByTestId('split-kcal-breakfast')).toHaveText('639 kcal');
  await card.getByRole('button', { name: 'Standard' }).click();
  await expect(card.getByTestId('split-sum')).toHaveText('Summe 100 %');
  await expect(card.getByTestId('split-kcal-breakfast')).toHaveText('502 kcal');
});
