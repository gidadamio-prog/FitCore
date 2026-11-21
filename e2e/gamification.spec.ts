import { expect, test, type Page } from '@playwright/test';
import { dismissCelebrations, onboard } from './helpers';

async function freeWorkout(page: Page, weight: string, reps: string) {
  await page.goto('/#/training');
  await page.getByRole('button', { name: 'Freies Training' }).click();
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  await page.getByRole('dialog').getByLabel('Übung suchen').fill('Bankdrücken (Langhantel)');
  await page.getByRole('dialog').getByRole('button', { name: /^Bankdrücken \(Langhantel\)/ }).click();
  const ex = page.getByTestId('workout-exercise').first();
  await ex.getByLabel('Satz 1 Gewicht').fill(weight);
  await ex.getByLabel('Satz 1 Wiederholungen').fill(reps);
  await ex.getByRole('button', { name: 'Satz 1 abschließen' }).click();
  await page.getByRole('button', { name: 'Training abschließen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abschließen' }).click();
}

test('Gamification: EP aus echten Daten, Abzeichen- und PR-Feier, Ruhmeshalle, Abzug beim Löschen', async ({ page }) => {
  await onboard(page);
  const card = page.getByTestId('game-card');
  await expect(card.getByTestId('rank-name')).toHaveText('Tiro');
  await expect(card.getByTestId('xp-total')).toHaveText('5'); // Gewicht beim Onboarding gemessen

  await freeWorkout(page, '60', '10');
  await expect(page.getByTestId('celebration-title')).toHaveText('Veteran · Bronze'); // erstes Workout
  await dismissCelebrations(page);

  await freeWorkout(page, '65', '10');
  await expect(page.getByTestId('celebration-title')).toHaveText('Bankdrücken (Langhantel)');
  await expect(page.getByRole('dialog')).toContainText('65 kg × 10');
  await dismissCelebrations(page);

  await page.goto('/#/erfolge');
  await expect(page.getByTestId('hall-of-fame')).toContainText('65 kg × 10 (vorher 60 kg)');
  await expect(page.getByTestId('badge-workouts')).toContainText('Bronze');
  // 5 (Wiegen) + 2×50 (Workouts) + 25 (PR) + ggf. Feldzug „Neuer Rekord“ (100) = 130 bzw. 230
  const xp = Number((await page.getByTestId('xp-total').first().textContent())!.replace('.', ''));
  expect([130, 230]).toContain(xp);
  await expect(page.getByTestId('xp-table')).toContainText('Neue Bestleistung');

  // Löschen entzieht Punkte wieder
  await page.goto('/#/training?tab=history');
  await page.getByTestId('history-list').getByRole('button').first().click();
  await page.getByRole('button', { name: 'Workout löschen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByTestId('history-list').getByRole('button')).toHaveCount(1); // Löschen abgeschlossen
  await page.getByRole('button', { name: 'Ruhmeshalle (Erfolge)' }).click();
  await expect(page.getByTestId('xp-total').first()).toHaveText('55');
});
