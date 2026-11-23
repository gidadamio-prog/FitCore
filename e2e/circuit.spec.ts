import { expect, test } from '@playwright/test';
import { nav, onboard } from './helpers';

async function pick(page: import('@playwright/test').Page, q: string, name: RegExp) {
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Übung suchen').fill(q);
  await dlg.getByRole('button', { name }).first().click();
}

test('Einheit (Zirkel) im Plan: Durchgänge, Pause nach Durchgang, Einzelübungen davor und danach', async ({ page }) => {
  await onboard(page);
  await nav(page, 'Training');
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByLabel('Planname').fill('EGYM-Tag');
  const wd = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date().getDay()]!;
  await page.getByRole('button', { name: wd, exact: true }).click();

  // Aufwärmen als einzelne Übung
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  await pick(page, 'Seitheben', /^Seitheben/);
  const single = page.getByTestId('plan-exercise').first();
  // Zahlenfeld: leeren und neu tippen ergibt keine führende 0
  const sets = single.getByLabel('Sätze');
  await sets.fill('');
  await expect(sets).toHaveValue('');
  await sets.pressSequentially('2');
  await expect(sets).toHaveValue('2');
  // Wiederholungen ohne Mindestwert
  await single.getByLabel('Wdh.', { exact: true }).fill('15');

  // Einheit mit zwei EGYM-Stationen
  await page.getByRole('button', { name: 'Einheit hinzufügen' }).click();
  await pick(page, 'EGYM Brust', /^EGYM Brustpresse/);
  const group = page.getByTestId('plan-group');
  await expect(group.getByTestId('plan-group-exercise')).toHaveCount(1);
  await group.getByRole('button', { name: 'Übung zur Einheit' }).click();
  await pick(page, 'EGYM Ruder', /^EGYM Ruderzug/);
  await expect(group.getByTestId('plan-group-exercise')).toHaveCount(2);
  await expect(group.getByLabel('Durchgänge')).toHaveValue('2');
  await group.getByLabel('Pause nach Durchgang s').fill('45');

  await page.getByRole('button', { name: 'Speichern & aktivieren' }).click();
  await expect(page.getByTestId('plan-card').first()).toContainText('aktiv');

  // Training: Einheit rundenweise
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Training starten' }).click();
  const card = page.getByTestId('workout-group');
  await expect(card).toContainText('2 Durchgänge · Pause 45s nach jedem Durchgang');
  await expect(card.getByTestId('group-round')).toHaveCount(2);
  const r1 = card.getByTestId('group-round').first();
  await r1.getByLabel('EGYM Brustpresse Durchgang 1 Wiederholungen').fill('12');
  await r1.getByRole('button', { name: 'EGYM Brustpresse Durchgang 1 abschließen' }).click();
  await expect(page.getByTestId('rest-remaining')).toHaveText('0:00'); // Wechsel ohne Pause
  await r1.getByLabel('EGYM Ruderzug Durchgang 1 Wiederholungen').fill('12');
  await r1.getByRole('button', { name: 'EGYM Ruderzug Durchgang 1 abschließen' }).click();
  // Durchgang fertig → Pause der Einheit
  await expect(page.getByTestId('rest-remaining')).toHaveText(/0:4[0-5]/);
  await expect(page.getByTestId('workout-exercise')).toHaveCount(1); // Einzelübung bleibt normal
});
