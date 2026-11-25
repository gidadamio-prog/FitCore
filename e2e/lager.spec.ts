import { expect, test } from '@playwright/test';
import { dismissCelebrations, onboard, openStation } from './helpers';

test('AK-113 Startseite als Lager: Held im Fokus, Stationen als Bildszenen mit Ausbaustufen', async ({ page }) => {
  await onboard(page);
  // ohne Held: Aufforderung im Lager
  await expect(page.getByTestId('today-hero')).toContainText('Erschaffe deinen Helden');
  for (const id of ['station-proviant', 'station-training', 'steps-card', 'station-brunnen', 'station-heiler', 'station-kartentisch']) await expect(page.getByTestId(id)).toBeVisible();
  // Kacheln sind klein; Antippen vergrößert (nur eine zugleich)
  await expect(page.getByTestId('station-proviant')).toHaveAttribute('data-open', 'false');
  await openStation(page, 'Proviant');
  await expect(page.getByTestId('station-proviant')).toHaveAttribute('data-open', 'true');
  await expect(page.getByTestId('tier-proviant')).toContainText('Stufe I · Reiserucksack');
  await expect(page.getByTestId('tier-proviant')).toContainText('bis Packesel');
  await openStation(page, 'Brunnen');
  await expect(page.getByTestId('station-proviant')).toHaveAttribute('data-open', 'false');
  await page.getByRole('button', { name: 'Brunnen verkleinern' }).click();
  await expect(page.getByTestId('station-brunnen')).toHaveAttribute('data-open', 'false');

  // Wasser im Brunnen
  await page.getByRole('button', { name: 'Wasser +250 ml' }).click();
  await expect(page.getByTestId('water-today')).toHaveText('0,25');

  // Held erschaffen → steht im Lager
  await page.getByTestId('today-hero').click();
  const form = page.getByTestId('hero-form');
  await form.getByLabel('Name des Helden').fill('Maximus');
  await form.getByRole('radio', { name: /Legionär/ }).click();
  await form.getByRole('button', { name: 'Schild' }).click();
  await form.getByRole('button', { name: 'Held erschaffen' }).click();
  await dismissCelebrations(page);
  await page.goto('/#/');
  const camp = page.getByTestId('hero-camp');
  await expect(camp).toContainText('Maximus');
  await expect(camp.getByTestId('hero-figure')).toBeVisible();
  await expect(camp.getByTestId('camp-ap')).toContainText('AP');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lager-top.png' });
  await page.getByTestId('stations').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/lager-kacheln.png' });
  await openStation(page, 'Proviant');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/lager-proviant.png' });

  // Szene antippen öffnet das Essen
  await page.getByRole('button', { name: 'Proviant – Essen eintragen' }).click();
  await expect(page.getByRole('dialog').getByLabel('Lebensmittel suchen')).toBeVisible();
});
