import { expect, test } from '@playwright/test';
import { dismissCelebrations, nav, onboard } from './helpers';

async function pick(page: import('@playwright/test').Page, q: string, name: RegExp) {
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Übung suchen').fill(q);
  await dlg.getByRole('button', { name }).first().click();
}

test('Übungsübersicht: Regionen statt langer Liste', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/training?tab=exercises');
  const list = page.getByTestId('exercise-list');
  await expect(list.getByTestId('exercise-region').first()).toBeVisible();
  await expect(list.getByRole('button', { name: /^Bankdrücken \(Langhantel\)/ })).toHaveCount(0); // eingeklappt
  await page.getByRole('group', { name: 'Körperregion' }).getByRole('button', { name: 'Brust' }).click();
  await expect(list).toContainText('Bankdrücken (Langhantel)');
  await expect(list).not.toContainText('Kniebeuge (Langhantel)');
});

test('Bestehende Übungen nachträglich zur Einheit zusammenfassen', async ({ page }) => {
  await onboard(page);
  await nav(page, 'Training');
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByLabel('Planname').fill('Flex');
  for (const [q, n] of [['EGYM Brust', /^EGYM Brustpresse/], ['EGYM Ruder', /^EGYM Ruderzug/], ['Seitheben', /^Seitheben/]] as const) {
    await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
    await pick(page, q, n);
  }
  await expect(page.getByTestId('plan-exercise')).toHaveCount(3);
  await page.getByRole('button', { name: 'Zusammenfassen' }).click();
  await page.getByRole('button', { name: 'Auswählen: EGYM Brustpresse' }).click();
  await page.getByRole('button', { name: 'Auswählen: EGYM Ruderzug' }).click();
  await expect(page.getByTestId('merge-bar')).toContainText('2 Übung(en) ausgewählt');
  await page.getByRole('button', { name: 'Als Einheit zusammenfassen' }).click();
  const g = page.getByTestId('plan-group');
  await expect(g.getByTestId('plan-group-exercise')).toHaveCount(2);
  await expect(page.getByTestId('plan-exercise')).toHaveCount(1);
  await expect(g.getByLabel('Durchgänge')).toHaveValue('3'); // aus den bisherigen 3 Sätzen
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByTestId('plan-card').first()).toContainText('Flex');
});

test('Dauer eines abgeschlossenen Trainings nachträglich korrigieren', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/training');
  await page.getByRole('button', { name: 'Freies Training' }).click();
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  await pick(page, 'Kniebeuge (Langhantel)', /^Kniebeuge \(Langhantel\)/);
  const ex = page.getByTestId('workout-exercise').first();
  await ex.getByLabel('Satz 1 Gewicht').fill('100');
  await ex.getByLabel('Satz 1 Wiederholungen').fill('5');
  await ex.getByRole('button', { name: 'Satz 1 abschließen' }).click();
  await page.getByRole('button', { name: 'Training abschließen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abschließen' }).click();
  await dismissCelebrations(page);
  const card = page.getByTestId('duration-card');
  await card.getByLabel('Dauer (Min.)').fill('45');
  await card.getByRole('button', { name: 'Dauer übernehmen' }).click();
  await expect(page.getByText('45:00', { exact: true })).toBeVisible();
  // 80 kg × Netto-MET 4 (5 − 1) × 0,75 h = 240 kcal
  await expect(card).toContainText('240 kcal geschätzt');
});
