import { expect, test } from '@playwright/test';
import { onboard, openStation } from './helpers';

test('Schritte eintragen, Aufträge der Woche wählen (3 aus 5)', async ({ page }) => {
  await onboard(page);
  // Schrittzähler (Kachel: +1.000 direkt, Eingabe nach dem Vergrößern)
  await page.getByTestId('steps-card').getByRole('button', { name: '1.000 Schritte hinzufügen' }).click();
  await expect(page.getByTestId('steps-card')).toContainText('1.000');
  await openStation(page, 'Wanderpfad');
  const steps = page.getByTestId('steps-card');
  await steps.getByLabel('Schritte heute').fill('6500');
  await steps.getByLabel('Schritte heute').blur();
  await expect(steps.getByTestId('steps-status')).toContainText('Noch 1.500 bis zum Ziel');
  await steps.getByRole('button', { name: '1.000 Schritte hinzufügen' }).click();
  await steps.getByRole('button', { name: '1.000 Schritte hinzufügen' }).click();
  await expect(steps.getByTestId('steps-status')).toContainText('Ziel erreicht – 8.500 Schritte');

  // Quest-Brett in der Ruhmeshalle
  await page.goto('/#/erfolge?tab=feldzug');
  const offers = page.getByTestId('quest-offers');
  await expect(offers.locator('button[aria-pressed]')).toHaveCount(5);
  const start = offers.getByRole('button', { name: /Aufträge annehmen/ });
  await expect(start).toBeDisabled();
  for (let k = 0; k < 3; k++) await offers.locator('button[aria-pressed]').nth(k).click();
  await expect(start).toHaveText(/3\/3/);
  await start.click();
  await expect(page.getByTestId('quest-offers')).toHaveCount(0);
  await expect(page.getByTestId('quest')).toHaveCount(3);
});
