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
