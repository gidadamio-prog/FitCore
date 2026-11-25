import { expect, test } from '@playwright/test';
import { dismissCelebrations, onboard } from './helpers';
import { encodeShare, type ShareCard } from '../src/domain/rpg';

const friend: ShareCard = { v: 1, id: 'friend-1', n: 'Lucius', k: 'cursor', e: 'fulmen', col: '#2f5fa8', t: 'der Unbeugsame', l: 14, x: 8200, f: 2600, w: 640, s: 90, b: 4, c: 2, d: new Date().toISOString().slice(0, 10) };

test('RPG: Held erschaffen, Feldzug, Teilen-Link, Rivale per Link, Rangliste, Markt', async ({ page }) => {
  await page.addInitScript(() => {
    (navigator as unknown as { share: (d: ShareData) => Promise<void> }).share = async (d: ShareData) => {
      (window as unknown as { __shared: ShareData }).__shared = d;
    };
  });
  await onboard(page);
  await expect(page.getByTestId('today-hero')).toContainText('Erschaffe deinen Helden');
  await page.getByTestId('today-hero').click();

  // Held erschaffen
  const form = page.getByTestId('hero-form');
  await form.getByLabel('Name des Helden').fill('Maximus');
  await form.getByRole('radio', { name: /Legionär/ }).click();
  await form.getByRole('button', { name: 'Schild' }).click();
  await form.getByRole('button', { name: 'Held erschaffen' }).click();
  await expect(page.getByTestId('hero-name')).toContainText('Maximus');
  await expect(page.getByTestId('hero-level')).toHaveText('Stufe 1');
  await expect(page.getByTestId('battle-score')).toHaveText('5'); // Wiegen beim Onboarding
  await expect(page.getByTestId('attributes')).toBeVisible();

  // Charakterbogen: Start-Set des Legionärs, Erscheinung Stufe 1 (Tiro)
  const sheet = page.getByTestId('character-sheet');
  await expect(sheet.getByTestId('slot-main')).toHaveAccessibleName('Haupthand: Holzschwert');
  await expect(sheet.getByTestId('slot-off')).toHaveAccessibleName('Nebenhand: Holzschild');
  await expect(sheet.getByTestId('appearance-stage')).toContainText('Erscheinung 1/5');
  // Grundkörper aus dem Onboarding-Gewicht (80 kg, 180 cm, 30 J., KFA geschätzt ≈ 20 %)
  await expect(sheet.getByTestId('hero-figure')).toHaveAttribute('data-body', 'durchschnitt');
  await expect(sheet.getByTestId('body-type')).toContainText('Durchschnitt (geschätzt)');
  await sheet.getByTestId('slot-main').click();
  const inv = page.getByTestId('inventory');
  await expect(inv.getByTestId('inv-waffe-schwert-00')).toContainText('angelegt');
  await expect(inv.getByTestId('inv-waffe-schwert-00')).toContainText('Schwert I · Angriff +5');
  await page.getByTestId('inventory-locked').locator('summary').click();
  await expect(page.getByTestId('inv-waffe-dolch-00')).toContainText('Markt');
  await expect(page.getByTestId('inv-waffe-streitaxt-00')).toContainText('Zweihand');
  await page.getByRole('button', { name: 'Haupthand ablegen' }).click();
  await expect(sheet.getByTestId('slot-main')).toHaveAccessibleName('Haupthand: leer');
  await sheet.getByTestId('slot-main').click();
  await page.getByTestId('inv-waffe-schwert-00').getByRole('button', { name: 'Anlegen' }).click();
  await expect(sheet.getByTestId('slot-main')).toHaveAccessibleName('Haupthand: Holzschwert');

  // Klasse = Trainingsfokus
  await expect(page.getByTestId('class-focus')).toContainText('Kraft und Muskelaufbau');
  await expect(page.getByTestId('class-focus')).toContainText('Disziplin der Legion');

  // Lebensweg = Ernährungsziel (neue Zielversion mit Vorschau)
  const life = page.getByTestId('life-path');
  await life.getByTestId('path-epikureer').click();
  await expect(page.getByTestId('path-preview')).toContainText('Kalorien');
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(life.getByTestId('path-epikureer')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/#/settings');
  await page.getByRole('tab', { name: 'Ziele' }).click();
  await expect(page.getByText('Lebensweg: Epikureer').first()).toBeVisible();
  await page.goto('/#/erfolge?tab=held');

  // Feldzug
  await page.getByRole('tab', { name: 'Feldzug' }).click();
  await expect(page.getByTestId('boss-name')).toHaveText('Vercingetorix');
  await expect(page.getByTestId('boss-hp')).toContainText('224 / 224 LP'); // Bosse nur im direkten Kampf
  await expect(page.getByTestId('province-current')).toHaveCount(1);
  await expect(page.getByTestId('duel')).toBeVisible();

  // Teilen
  await page.getByRole('tab', { name: 'Arena' }).click();
  await expect(page.getByTestId('ranking-me')).toContainText('Maximus');
  await page.getByRole('button', { name: 'Teilen' }).click();
  const shared = await page.waitForFunction(() => (window as unknown as { __shared?: ShareData }).__shared).then((h) => h.jsonValue() as Promise<ShareData>);
  expect(shared.url).toMatch(/#\/erfolge\?tab=arena&rivale=FC1\./);
  expect(shared.text).toContain('Maximus');
  expect(shared.text).toContain('Kampfwert (28 Tage): 5');

  // Eigenen Code einlesen → abgelehnt
  await page.goto(shared.url!.replace(/^.*#/, '/#'));
  await page.getByTestId('rival-preview').getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText('Das ist dein eigener Held.')).toBeVisible();

  // Link eines Freundes
  await page.goto('/#/erfolge?tab=arena&rivale=' + encodeShare(friend));
  const preview = page.getByTestId('rival-preview');
  await expect(preview).toContainText('Lucius');
  await expect(preview).toContainText('Kampfwert 2.600');
  await preview.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByTestId('ranking-rival')).toContainText('Lucius');
  const rows = page.getByTestId('ranking').locator('li');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Lucius'); // höherer Kampfwert oben
  await page.getByRole('tab', { name: 'Stufe' }).click();
  await expect(rows.first()).toContainText('Lucius');

  // Beschädigter Code wird abgelehnt
  await page.getByLabel('Arena-Code oder Link').fill('FC1.abc.zzzzz');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText(/beschädigt/)).toBeVisible();

  // Markt: noch zu wenig Denare; Waffen Stufe I käuflich, Stufe II erst ab höherem Rang
  await page.getByRole('tab', { name: 'Markt' }).click();
  await expect(page.getByTestId('denare')).toHaveText('0');
  await expect(page.getByTestId('shop-palette-byzanz').getByRole('button')).toBeDisabled();
  const ws = page.getByTestId('weapon-shop');
  await expect(ws.getByTestId('shop-weapon-waffe-schwert-00')).toContainText('im Inventar');
  await ws.getByRole('tab', { name: 'Dolch' }).click();
  await expect(ws.getByTestId('shop-weapon-waffe-dolch-00').getByRole('button')).toBeDisabled();
  await expect(ws.getByTestId('shop-weapon-waffe-dolch-01')).toContainText('ab Rang');

  // Ruhm: geheime Erfolge verdeckt, Abzeichen mit Belohnung
  await page.getByRole('tab', { name: 'Ruhm' }).click();
  await expect(page.getByTestId('secret-fruehaufsteher')).toContainText('???');
  await expect(page.getByTestId('reward-prs')).toContainText('Legionärsschwert');
  await dismissCelebrations(page);
  // Kein horizontales Überlaufen auf dem Handy
  for (const t of ['Held', 'Inventar', 'Feldzug', 'Arena', 'Ruhm', 'Markt']) {
    await page.getByRole('tab', { name: t, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
});
