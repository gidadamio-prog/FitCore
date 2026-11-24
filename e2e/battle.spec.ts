import { expect, test } from '@playwright/test';
import { createAndActivatePlan, createCustomFood, dismissCelebrations, onboard } from './helpers';

async function createHero(page: import('@playwright/test').Page) {
  await page.getByTestId('today-hero').click();
  const form = page.getByTestId('hero-form');
  await form.getByLabel('Name des Helden').fill('Maximus');
  await form.getByRole('radio', { name: /Legionär/ }).click();
  await form.getByRole('button', { name: 'Schild' }).click();
  await form.getByRole('button', { name: 'Held erschaffen' }).click();
  await dismissCelebrations(page);
}

test('Bilanz mit Aktionspunkten nach Training und nach abgeschlossener Mahlzeit', async ({ page }) => {
  await onboard(page);
  await createHero(page);

  // Training: Plan starten, Satz abschließen, beenden → Kampf mit Zusammenfassung
  await createAndActivatePlan(page);
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Training starten' }).click();
  await expect(page.getByTestId('workout-elapsed')).toContainText('Trainingszeit');
  const ex = page.getByTestId('workout-exercise').first();
  await ex.getByLabel('Satz 1 Wiederholungen').fill('8');
  await ex.getByRole('button', { name: 'Satz 1 abschließen' }).click();
  await page.getByRole('button', { name: 'Training abschließen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abschließen' }).click();

  const battle = page.getByTestId('battle');
  await expect(battle).toBeVisible();
  const result = page.getByTestId('battle-result');
  await expect(result).toContainText('Training beendet');
  await expect(result.getByTestId('battle-summary')).toContainText('1 Sätze');
  await expect(result.getByTestId('battle-summary')).toContainText(/kg Volumen/);
  await expect(result.getByTestId('battle-ap')).toHaveText('+2 Aktionspunkte');
  await result.getByRole('button', { name: 'Weiter' }).click();
  await expect(battle).toHaveCount(0);
  await dismissCelebrations(page);

  // Mahlzeit abschließen → Kampf; danach als abgeschlossen markiert
  await createCustomFood(page, 'Haferbrei', 350, 15, 55, 7);
  await page.getByRole('tab', { name: 'Tagebuch' }).click();
  await page.getByRole('button', { name: 'Frühstück: Lebensmittel hinzufügen' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Lebensmittel suchen').fill('Haferbrei');
  await dlg.getByRole('button', { name: /^Haferbrei/ }).click();
  await dlg.getByLabel('Menge').fill('100');
  await dlg.getByRole('button', { name: 'Hinzufügen' }).click();
  await page.getByTestId('add-done').click();
  await expect(page.getByTestId('meal-breakfast')).toContainText('Haferbrei');
  await page.getByTestId('meal-close-breakfast').click();
  await expect(battle).toBeVisible();
  await expect(page.getByTestId('battle-result')).toContainText('Frühstück abgeschlossen');
  await expect(page.getByTestId('battle-ap')).toHaveText('+1 Aktionspunkte'); // Tag protokolliert
  await page.getByTestId('battle-result').getByRole('button', { name: 'Zur Karte' }).click();
  await expect(page.getByTestId('world-map')).toBeVisible();
  await expect(page.getByTestId('ap')).toContainText('8'); // 5 Start + 2 Training + 1 Protokoll
  await page.goBack();
  await expect(page.getByTestId('meal-closed-breakfast')).toBeVisible();
});
