import { expect, test } from '@playwright/test';
import { createCustomFood, nav, onboard } from './helpers';
import fs from 'node:fs';
import os from 'node:os';
import pathMod from 'node:path';

test('E2E-11 Offline: lokale Kernfunktionen nutzen → Verbindung wiederherstellen', async ({ page, context }) => {
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // SW kontrolliert jetzt die Seite
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Hallo Giuliano')).toBeVisible();
  await expect(page.getByText(/Offline – lokale Daten/)).toBeVisible();
  await createCustomFood(page, 'Apfel', 52, 0.3, 14, 0.2);
  await page.getByRole('tab', { name: 'Tagebuch' }).click();
  await page.getByRole('button', { name: 'Snacks: Lebensmittel hinzufügen' }).click();
  await page.getByRole('dialog').getByLabel('Lebensmittel suchen').fill('Apfel');
  await page.getByRole('dialog').getByRole('button', { name: /^Apfel/ }).click();
  await page.getByRole('dialog').getByLabel('Menge').fill('150');
  await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByTestId('day-kcal')).toHaveText('78');
  await nav(page, 'Körper');
  await page.getByRole('button', { name: 'Messung' }).click();
  await page.getByRole('dialog').getByLabel('Gewicht (kg)').fill('79.5');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await page.getByRole('tab', { name: 'Messungen' }).click();
  await expect(page.getByTestId('measurement-list')).toContainText('79,5 kg');
  // Trainingspläne offline
  await nav(page, 'Training');
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByLabel('Planname').fill('Offline-Plan');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByTestId('plan-card')).toContainText('Offline-Plan');
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText(/Offline – lokale Daten/)).toHaveCount(0);
  await nav(page, 'Ernährung');
  await expect(page.getByTestId('day-kcal')).toHaveText('78');
});

test('E2E-12 Backup → getrennte Instanz wiederherstellen → Integrität', async ({ page, browser }) => {
  await onboard(page);
  await createCustomFood(page, 'Quark', 67, 12, 4, 0.2);
  await page.getByRole('tab', { name: 'Tagebuch' }).click();
  await page.getByRole('button', { name: 'Abendessen: Lebensmittel hinzufügen' }).click();
  await page.getByRole('dialog').getByLabel('Lebensmittel suchen').fill('Quark');
  await page.getByRole('dialog').getByRole('button', { name: /^Quark/ }).click();
  await page.getByRole('dialog').getByLabel('Menge').fill('500');
  await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen' }).click();
  await page.goto('/#/settings');
  await page.getByRole('tab', { name: 'Daten' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Backup exportieren' }).click()]);
  const path = pathMod.join(fs.mkdtempSync(pathMod.join(os.tmpdir(), 'fc-')), 'backup.json');
  await dl.saveAs(path);
  const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  expect(json.app).toBe('fitcore');
  expect(json.tables.diary).toHaveLength(1);

  const ctx2 = await browser.newContext({ locale: 'de-DE' });
  const p2 = await ctx2.newPage();
  await p2.goto(page.url().split('#')[0]!);
  await expect(p2.getByRole('button', { name: 'Weiter' })).toBeVisible(); // frische Instanz → Onboarding
  await p2.getByTestId('onboarding-restore').setInputFiles(path);
  await expect(p2.getByText('Hallo Giuliano')).toBeVisible();
  await p2.goto(page.url().split('#')[0] + '#/nutrition');
  await expect(p2.getByTestId('meal-dinner')).toContainText('Quark');
  await expect(p2.getByTestId('day-kcal')).toHaveText('335');
  // Re-Export identisch (bis auf Zeitstempel)
  await p2.goto(page.url().split('#')[0] + '#/settings');
  await p2.getByRole('tab', { name: 'Daten' }).click();
  const [dl2] = await Promise.all([p2.waitForEvent('download'), p2.getByRole('button', { name: 'Backup exportieren' }).click()]);
  const path2 = pathMod.join(pathMod.dirname(path), 'backup2.json');
  await dl2.saveAs(path2);
  const json2 = JSON.parse(fs.readFileSync(path2, 'utf8'));
  delete json.exportedAt;
  delete json2.exportedAt;
  delete json.tables.settings; // Theme-Einstellungen sind gerätespezifisch identisch
  delete json2.tables.settings;
  expect(json2).toEqual(json);
  await ctx2.close();
});
