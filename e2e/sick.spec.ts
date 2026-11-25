import { expect, test } from '@playwright/test';
import { onboard, openStation } from './helpers';

test('AK-112 Krankentag: heute/gestern melden, Hinweis, Heiltrank-Auftrag, zurücknehmen', async ({ page }) => {
  await onboard(page);
  await page.getByTestId('sick-open').click();
  await expect(page.getByRole('dialog')).toContainText('bricht aber nichts');
  await page.getByTestId('sick-today').click();
  await page.getByTestId('sick-yesterday').click();
  await expect(page.getByTestId('sick-yesterday')).toHaveText('Gestern doch nicht krank');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('sick-banner')).toContainText('Krankentag');
  await expect(page.getByTestId('sick-open')).toHaveText(/Krank gemeldet/);
  await expect(page.getByTestId('station-training')).toContainText('Krankentag');
  await openStation(page, 'Übungsplatz');
  await expect(page.getByTestId('sick-training')).toBeVisible();
  await expect(page.getByTestId('daily-quest')).toContainText('Heiltrank');
  await page.screenshot({ path: 'test-results/sick-today.png' });
  await page.getByTestId('sick-undo').click();
  await expect(page.getByTestId('sick-banner')).toHaveCount(0);
  await expect(page.getByTestId('sick-open')).toHaveText(/Krank\?/);
});
