import { expect, test } from '@playwright/test';
import { dismissCelebrations, onboard } from './helpers';

test('AK-109 Rüstung: Start-Set auf der Figur, Kopfteil verdeckt Frisur, ganzes Set → Set-Bonus, Markt nach Rang', async ({ page }) => {
  await onboard(page);
  await page.getByTestId('today-hero').click();
  const form = page.getByTestId('hero-form');
  await form.getByLabel('Name des Helden').fill('Maximus');
  await form.getByRole('radio', { name: /Legionär/ }).click();
  await form.getByRole('button', { name: 'Schild' }).click();
  await form.getByRole('button', { name: 'Held erschaffen' }).click();
  await dismissCelebrations(page);
  const sheet = page.getByTestId('character-sheet');
  await expect(sheet.getByTestId('slot-chest')).toHaveAccessibleName('Brust: Novizen-Gewand');
  await expect(sheet.getByTestId('slot-head')).toHaveAccessibleName('Kopf: leer');
  const fig = sheet.getByTestId('hero-figure');
  await expect(fig.getByTestId('armor-chest')).toBeVisible();
  await expect(fig.getByTestId('armor-legs')).toBeVisible();
  await expect(fig.getByTestId('armor-hands-L')).toBeVisible();
  await expect(fig.getByTestId('armor-feet-R')).toBeVisible();

  // Frisur wählen, dann Kapuze aufsetzen → Frisur verschwindet
  await sheet.getByRole('button', { name: 'Aussehen' }).click();
  await page.getByTestId('look-hair-locken').click();
  await page.keyboard.press('Escape');
  await expect(fig.getByTestId('layer-hair')).toBeVisible();
  await sheet.getByTestId('slot-head').click();
  const inv = page.getByTestId('inventory');
  await expect(inv.getByTestId('inv-armor-25-head')).toContainText(/Set ab Rang/);
  await inv.getByTestId('inv-armor-00-head').getByRole('button', { name: 'ganzes Set anlegen' }).click();
  await expect(fig.getByTestId('armor-head')).toBeVisible();
  await expect(fig.getByTestId('layer-hair')).toHaveCount(0);
  await expect(sheet.getByTestId('armor-set-bonus')).toContainText('Set-Bonus: Novize (Stoff)');
  await expect(sheet.getByTestId('armor-set-effects')).toHaveText('+5 % EP aus Training');

  // Kapuze angelegt lassen, aber auf der Figur ausblenden → Frisur wieder sichtbar, Set-Bonus bleibt
  await sheet.getByTestId('slot-head').click();
  await page.getByTestId('toggle-armor-hidden').click();
  await page.keyboard.press('Escape');
  await expect(sheet.getByTestId('slot-head')).toHaveAccessibleName('Kopf: Novizen-Kapuze (ausgeblendet)');
  await expect(fig.getByTestId('armor-head')).toHaveCount(0);
  await expect(fig.getByTestId('layer-hair')).toBeVisible();
  await expect(sheet.getByTestId('armor-set-bonus')).toBeVisible();

  // Sichtbarkeit direkt unter der Figur: alle ausblenden → Figur ohne Rüstung, Bonus bleibt; alle zeigen
  await sheet.getByTestId('armor-visibility').click();
  await expect(page.getByRole('dialog').getByRole('group', { name: 'Rüstungsfarbe' })).toBeVisible();
  await page.getByTestId('vis-all-off').click();
  await expect(fig.getByTestId('armor-chest')).toHaveCount(0);
  await expect(page.getByTestId('vis-chest')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('vis-all-on').click();
  await expect(fig.getByTestId('armor-chest')).toBeVisible();
  await expect(fig.getByTestId('armor-head')).toBeVisible();
  await page.getByTestId('vis-head').click();
  await page.keyboard.press('Escape');
  await expect(fig.getByTestId('armor-head')).toHaveCount(0);
  await expect(sheet.getByTestId('armor-set-bonus')).toBeVisible();

  // Rüstungsfarbe: 3 zum Start (Original, Nachtblau, Rabenschwarz), Rest gesperrt
  await sheet.getByRole('button', { name: 'Aussehen' }).click();
  await page.getByTestId('look-editor').getByRole('tab', { name: 'Farben' }).click();
  const colors = page.getByRole('group', { name: 'Rüstungsfarbe' });
  await expect(colors.locator('button:not([aria-label*="gesperrt"])')).toHaveCount(3);
  await colors.getByTestId('armorcolor-nachtblau').click();
  await expect(colors.getByTestId('armorcolor-nachtblau')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(fig.getByTestId('armor-legs-dye')).toBeVisible();
  await page.waitForTimeout(400);
  await sheet.screenshot({ path: 'test-results/armor-sheet.png' });

  // Markt: Stoff kaufbar, Leder erst ab Rang 3
  await page.goto(page.url().split('#')[0] + '#/erfolge');
  await page.getByRole('tab', { name: 'Markt' }).click();
  const shop = page.getByTestId('armor-shop');
  await expect(shop.getByTestId('armor-set-0')).toContainText('komplett');
  await shop.getByRole('tab', { name: /Leder/ }).click();
  await expect(shop).toContainText('Leder-Rüstung gibt es ab Rang');
});
