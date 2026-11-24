import { expect, test } from '@playwright/test';
import { dismissCelebrations, onboard } from './helpers';

test('AK-106 Aussehen: Frisur, Bart und Farben wählen, gesperrte zeigen den Weg zur Freischaltung', async ({ page }) => {
  await onboard(page);
  await page.getByTestId('today-hero').click();
  const form = page.getByTestId('hero-form');
  await form.getByLabel('Name des Helden').fill('Maximus');
  await form.getByRole('radio', { name: /Legionär/ }).click();
  await form.getByRole('button', { name: 'Schild' }).click();
  await form.getByRole('button', { name: 'Held erschaffen' }).click();
  await dismissCelebrations(page);

  const sheet = page.getByTestId('character-sheet');
  await sheet.getByRole('button', { name: 'Aussehen' }).click();
  const ed = page.getByTestId('look-editor');
  // 5 Start-Frisuren + Grundschnitt frei, Boss-Frisur gesperrt mit Hinweis
  const hair = ed.getByTestId('look-grid-hair');
  await expect(hair.locator('button:not([aria-label*="gesperrt"])')).toHaveCount(6);
  await expect(hair.getByTestId('look-hair-wellenmaehne')).toHaveAccessibleName(/gesperrt: Besiege Vercingetorix/);
  await hair.getByTestId('look-hair-locken').click();
  await expect(hair.getByTestId('look-hair-locken')).toHaveAttribute('aria-pressed', 'true');
  await hair.getByTestId('look-hair-wellenmaehne').click();
  await expect(page.getByText('Wellenmähne: Besiege Vercingetorix (Gallia)')).toBeVisible();
  await expect(hair.getByTestId('look-hair-locken')).toHaveAttribute('aria-pressed', 'true'); // bleibt

  await ed.getByRole('tab', { name: 'Bart' }).click();
  const beard = ed.getByTestId('look-grid-beard');
  await expect(beard.locator('button:not([aria-label*="gesperrt"])')).toHaveCount(6);
  await beard.getByTestId('look-beard-vollbart').click();

  await ed.getByRole('tab', { name: 'Farben' }).click();
  await expect(ed.getByTestId('color-hairColor-kupfer')).toHaveAccessibleName(/gesperrt/);
  await ed.getByTestId('color-hairColor-schwarz').click();
  await page.screenshot({ path: 'test-results/look-editor.png' });
  await page.keyboard.press('Escape');

  // Figur trägt Frisur und Bart in Schwarz
  const fig = sheet.getByTestId('hero-figure');
  await expect(fig.getByTestId('layer-hair')).toHaveAttribute('data-color', 'schwarz');
  await expect(fig.getByTestId('layer-beard')).toHaveAttribute('data-color', 'schwarz');
  await fig.screenshot({ path: 'test-results/look-figure.png' });
  // Auch im Porträt auf „Heute“
  await page.goto(page.url().split('#')[0] + '#/');
  await expect(page.getByTestId('today-hero').getByTestId('layer-hair')).toBeVisible();
});
