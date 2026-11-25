import { test } from '@playwright/test';
import { onboard } from './helpers';

const COMBOS: [string, string][] = [
  ['schwert', 'main=waffe-schwert-09&off=waffe-schild-09&set=25'],
  ['dolch', 'main=waffe-dolch-05&off=waffe-buch-05&set=5'],
  ['axt-kolben', 'main=waffe-axt-04&off=waffe-schild-04&set=14'],
  ['saebel', 'main=waffe-saebel-03&off=waffe-schild-02&set=19'],
  ['stange', 'main=waffe-stangenwaffe-09&set=28'],
  ['streitaxt', 'main=waffe-streitaxt-04&set=26'],
  ['hammer', 'main=waffe-kriegshammer-02&set=22'],
  ['bogen', 'main=waffe-bogen-03&set=17'],
  ['faust', 'main=waffe-faust-06&set=12'],
  ['kolben', 'main=waffe-kolben-03&off=waffe-buch-08&set=3'],
  ['boss1', 'main=waffe-boss-00&off=waffe-boss-04&set=32'],
  ['boss2', 'main=waffe-boss-05&set=30'],
  ['boss3', 'main=waffe-boss-07&off=waffe-boss-09&set=31'],
  ['boss4', 'main=waffe-boss-03&set=33'],
  ['boss5', 'main=waffe-boss-01&off=waffe-schild-06&set=24'],
  ['boss6', 'main=waffe-boss-02&off=waffe-schild-06&set=24'],
  ['boss7', 'main=waffe-boss-06&off=waffe-schild-06&set=24'],
  ['boss8', 'main=waffe-boss-08&set=24'],
];

test('Vorschau Waffen (nur mit VORSCHAU=1)', async ({ page }) => {
  test.skip(!process.env.VORSCHAU, 'Bildkontrolle, kein Regressionstest');
  test.setTimeout(240000);
  await onboard(page);
  const only = process.env.ONLY?.split(',');
  for (const [name, q] of COMBOS) {
    if (only && !only.includes(name)) continue;
    await page.goto(`/#/vorschau?${q}`);
    await page.getByTestId('vorschau').waitFor();
    await page.waitForTimeout(700);
    await page.getByTestId('vorschau').screenshot({ path: `test-results/vorschau-${name}.png` });
  }
});
