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
  await expect(page.getByTestId('tier-proviant')).toContainText('Ausbau I · Reiserucksack');
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

test('AK-120 Navigation und Startseite: Held-Bereich, Boss am Kartentisch, Wochenplan am Proviant, Stufe vs. Rang', async ({ page }) => {
  await onboard(page);
  // Boss steht am Kartentisch (keine eigene Boss-Karte mehr)
  const table = page.getByTestId('station-kartentisch');
  await expect(table.getByTestId('stage-boss-name')).toHaveText('Vercingetorix');
  await expect(table).toContainText('Kartentisch');
  await expect(page.getByTestId('boss-stage')).toHaveCount(1);

  // Stufe vs. Rang erklärt
  await page.getByTestId('level-rank-info').click();
  const sheet = page.getByTestId('level-rank-sheet');
  await expect(sheet).toContainText('Stufe 1 · Kampfkraft');
  await expect(sheet).toContainText('Rang 1 · Tiro');
  await expect(sheet).toContainText('Markt');
  await page.getByRole('button', { name: 'Schließen' }).click();

  // Wochenplan direkt vom Proviant
  await openStation(page, 'Proviant');
  await page.getByTestId('proviant-plan').click();
  await expect(page).toHaveURL(/tab=plan/);
  await expect(page.getByRole('tab', { name: 'Planung' })).toHaveAttribute('aria-selected', 'true');

  // Untere Leiste: „Held“ führt zu Held, Inventar, Aufträge, Arena, Markt – Ruhm liegt in den Statistiken
  const bar = page.getByRole('navigation', { name: 'Hauptnavigation' });
  if (await bar.isVisible()) {
    await bar.getByRole('link', { name: 'Held' }).click();
    await expect(page.getByRole('heading', { name: 'Held', level: 1 })).toBeVisible();
    for (const t of ['Held', 'Inventar', 'Aufträge', 'Arena', 'Markt']) await expect(page.getByRole('tab', { name: t, exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Ruhm' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ruhmeshalle (Erfolge)' })).toHaveCount(0);
    await bar.getByRole('link', { name: 'Statistik' }).click();
    await page.getByRole('tab', { name: 'Ruhm' }).click();
    await expect(page.getByTestId('secret-fruehaufsteher')).toContainText('???');
  }
});
