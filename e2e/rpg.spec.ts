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

  // Feldzug
  await page.getByRole('tab', { name: 'Feldzug' }).click();
  await expect(page.getByTestId('boss-name')).toHaveText('Vercingetorix');
  await expect(page.getByTestId('boss-hp')).toContainText('995 / 1.000 LP'); // 5 Schaden durch Wiegen
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

  // Markt: noch zu wenig Denare
  await page.getByRole('tab', { name: 'Markt' }).click();
  await expect(page.getByTestId('denare')).toHaveText('0');
  await expect(page.getByTestId('shop-palette-byzanz').getByRole('button')).toBeDisabled();
  await dismissCelebrations(page);
  // Kein horizontales Überlaufen auf dem Handy
  for (const t of ['Held', 'Feldzug', 'Arena', 'Ruhm', 'Markt']) {
    await page.getByRole('tab', { name: t, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
});
