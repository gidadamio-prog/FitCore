import { expect, test, type Page } from '@playwright/test';
import { dismissCelebrations, onboard } from './helpers';

async function createHero(page: Page) {
  await page.getByTestId('today-hero').click();
  const form = page.getByTestId('hero-form');
  await form.getByLabel('Name des Helden').fill('Maximus');
  await form.getByRole('radio', { name: /Legionär/ }).click();
  await form.getByRole('button', { name: 'Schild' }).click();
  await form.getByRole('button', { name: 'Held erschaffen' }).click();
  await dismissCelebrations(page);
}

test('AK-111 Weltkarte: Start mit 5 AP, Reisen kostet AP, Gegner blockiert bis besiegt, Truhe, Sperre nach Stufe', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 300)));
  await onboard(page);
  await createHero(page);
  await expect(page.locator('[aria-live="polite"] button')).toHaveCount(0, { timeout: 12000 });
  await page.getByRole('button', { name: 'Weltkarte' }).click();
  const map = page.getByTestId('world-map');
  await expect(map.getByTestId('ap')).toContainText('5');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/world-start.png' });
  // Erster Gegnertrupp der Arvernerhöhen ist sichtbar, der Ort dahinter liegt im Nebel
  await expect(map.getByTestId('node-arverner-a')).toBeVisible();
  await expect(map.getByTestId('node-arverner-b')).toHaveCount(0);
  await map.getByTestId('node-arverner-a').dispatchEvent('click');
  const sheet = page.getByTestId('node-sheet');
  await expect(sheet.getByTestId('foe-stats')).toBeVisible();
  await sheet.getByTestId('travel').click();
  await expect(map.getByTestId('ap')).toContainText('4');
  await map.getByTestId('node-arverner-a').dispatchEvent('click');
  await expect(sheet.getByTestId('win-chance')).toBeVisible();
  await sheet.getByTestId('fight').click();
  const battle = page.getByTestId('battle');
  await expect(battle).toBeVisible();
  await battle.getByRole('button', { name: 'Überspringen' }).click();
  await expect(battle.getByTestId('fight-verdict')).toHaveText('Sieg!');
  await battle.getByRole('button', { name: 'Weiter' }).click();
  await expect(map.getByTestId('ap')).toContainText('2');
  // Weg ist frei: Lager aufgedeckt, Reise dorthin
  await map.getByTestId('node-arverner-b').dispatchEvent('click');
  await sheet.getByTestId('travel').click();
  await expect(map.getByTestId('ap')).toContainText('1');
  // Dorf-Abzweig → Gegner dort blockiert nicht den Rückweg, Truhe dahinter liegt noch im Nebel
  await map.getByTestId('node-arverner-h').dispatchEvent('click');
  await sheet.getByTestId('travel').click();
  await expect(map.getByTestId('ap')).toContainText('0');
  await map.getByTestId('node-arverner-i').dispatchEvent('click');
  await expect(sheet.getByTestId('travel')).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/world-moved.png' });
});
