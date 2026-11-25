import { expect, test } from '@playwright/test';
import { createAndActivatePlan, createCustomFood, dismissCelebrations, mockOff, nav, onboard, openStation } from './helpers';

test('E2E-01 Profil anlegen → Kalorienziel berechnen → Dashboard prüfen', async ({ page }) => {
  await onboard(page);
  // 30 J., 80 kg, 180 cm, männlich: BMR 1780 · 1,375 = 2447,5; Abnehmen −0,4 kg/W → −440 kcal → 2008 kcal
  await openStation(page, 'Proviant');
  await expect(page.getByTestId('target-kcal')).toHaveText('2.008');
  await expect(page.getByTestId('eaten-kcal')).toHaveText('0');
  await expect(page.getByTestId('remaining-kcal')).toHaveText('2.008');
  await page.goto('/#/settings');
  await page.getByRole('tab', { name: 'Ziele' }).click();
  await expect(page.getByTestId('calc-bmr')).toHaveText('1.780 kcal');
  await expect(page.getByTestId('calc-tdee')).toHaveText('2.448 kcal');
  // AK-014: manuell überschreiben, Konsistenzhinweis, Historie
  await page.getByRole('button', { name: 'Manuell überschreiben' }).click();
  await page.getByLabel('kcal', { exact: true }).fill('1900');
  await expect(page.getByTestId('macro-consistency')).toContainText('weicht vom Kalorienziel ab');
  await page.getByRole('button', { name: 'Als neues Ziel speichern' }).click();
  await expect(page.getByText('Manuelle Anpassung')).toBeVisible();
  await page.goto('/#/');
  await openStation(page, 'Proviant');
  await expect(page.getByTestId('target-kcal')).toHaveText('1.900');
});

test('AK-016 Ungültige Eingaben im Onboarding werden verständlich abgelehnt', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Bitte gib einen Namen ein.')).toBeVisible();
  await page.getByLabel('Größe (cm)').fill('400');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Körpergröße (cm) muss zwischen 120 und 250 liegen.')).toBeVisible();
  await page.getByLabel('Geburtsdatum').fill(`${new Date().getFullYear() - 15}-01-01`);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText(/für Erwachsene/)).toBeVisible();
});

test('E2E-02 Lebensmittel suchen → Portion → buchen → Tageswerte', async ({ page }) => {
  await mockOff(page);
  await onboard(page);
  await page.getByRole('button', { name: 'Lebensmittel' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Lebensmittel suchen').fill('nutella');
  await dlg.getByTestId('online-results').getByRole('button', { name: /Nutella/ }).click();
  await dlg.getByLabel('Einheit').selectOption('g');
  await dlg.getByLabel('Menge').fill('200');
  await expect(dlg.getByTestId('nut-kcal')).toHaveText('1.078 kcal');
  await dlg.getByRole('button', { name: 'Hinzufügen' }).click();
  await page.getByTestId('add-done').click();
  await expect(page.getByTestId('day-kcal')).toHaveText('1.078');
  await expect(page.getByTestId('day-protein')).toContainText('12,6');
  await nav(page, 'Heute');
  await openStation(page, 'Proviant');
  await expect(page.getByTestId('eaten-kcal')).toHaveText('1.078');
  await expect(page.getByTestId('remaining-kcal')).toHaveText('930');
});

test('E2E-03 Barcode → protokollieren → erneut aufrufen', async ({ page }) => {
  await mockOff(page);
  await onboard(page);
  await nav(page, 'Ernährung');
  await page.getByRole('button', { name: 'Frühstück: Lebensmittel hinzufügen' }).click();
  await page.getByRole('button', { name: 'Barcode scannen' }).click();
  await page.getByLabel('Barcode manuell eingeben').fill('3017624010701');
  await page.getByRole('button', { name: 'Suchen' }).click();
  await expect(page.getByRole('dialog')).toContainText('EAN 3017624010701');
  await page.getByRole('dialog').getByLabel('Menge').fill('2'); // 2 × 15 g Portion
  await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen' }).click();
  await page.getByTestId('add-done').click();
  await expect(page.getByTestId('meal-breakfast')).toContainText('Nutella');
  await expect(page.getByTestId('day-kcal')).toHaveText('162');
  // Erneut: zuletzt verwendet + lokale Barcode-Suche ohne Netz
  await page.unroute('https://world.openfoodfacts.org/**');
  await page.route('https://world.openfoodfacts.org/**', (r) => r.abort());
  await page.getByRole('button', { name: 'Snacks: Lebensmittel hinzufügen' }).click();
  await page.getByRole('tab', { name: 'Zuletzt' }).click();
  await expect(page.getByRole('dialog')).toContainText('Nutella');
  await page.getByRole('button', { name: 'Barcode scannen' }).click();
  await page.getByLabel('Barcode manuell eingeben').fill('3017624010701');
  await page.getByRole('button', { name: 'Suchen' }).click();
  await expect(page.getByRole('dialog')).toContainText('EAN 3017624010701');
  // Unbekannter Barcode → selbst anlegen
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByRole('button', { name: 'Barcode scannen' }).click();
  await page.unroute('https://world.openfoodfacts.org/**');
  await mockOff(page);
  await page.getByLabel('Barcode manuell eingeben').fill('4000000000017');
  await page.getByRole('button', { name: 'Suchen' }).click();
  await expect(page.getByRole('dialog')).toContainText('wurde nicht gefunden');
});

test('E2E-04 Rezept erstellen → Portion berechnen → ins Tagebuch', async ({ page }) => {
  await onboard(page);
  await createCustomFood(page, 'Haferflocken', 372, 13.5, 58.7, 7);
  await createCustomFood(page, 'Milch', 64, 3.3, 4.8, 3.5);
  await page.getByRole('tab', { name: 'Rezepte' }).click();
  await page.getByRole('button', { name: 'Neues Rezept' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Name', { exact: true }).fill('Porridge');
  await expect(dlg.getByTestId('stepper-Portionen')).toHaveText('2'); // Standard für neue Rezepte
  await dlg.getByLabel('Zutat suchen').fill('Hafer');
  await dlg.getByRole('button', { name: /^Haferflocken 372/ }).click();
  await dlg.getByLabel('Zutat suchen').fill('Milch');
  await dlg.getByRole('button', { name: /^Milch 64/ }).click();
  await dlg.getByLabel('Menge Milch (g)').fill('300');
  await expect(dlg.getByTestId('recipe-summary')).toContainText('282 kcal');
  await dlg.getByText('Alle Nährwerte').click();
  await expect(dlg.getByTestId('recipe-nutrition')).toContainText('564 kcal');
  await dlg.getByRole('button', { name: 'Rezept speichern' }).click();
  await dismissCelebrations(page); // Abzeichen „Koch des Kaisers“
  await expect(page.getByTestId('recipe-card')).toContainText('282 kcal');
  await page.getByRole('button', { name: 'Ins Tagebuch' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Buchen' }).click();
  await page.getByRole('tab', { name: 'Tagebuch' }).click();
  await expect(page.getByTestId('day-kcal')).toHaveText('282');
});

test('AK-118 Rezept: Eier per Stück (S/M/L), Mehl gefunden, Fertiggewicht, Buchen in Gramm, Kopieren', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Ernährung' }).first().click();
  await page.getByRole('tab', { name: 'Rezepte' }).click();
  await page.getByRole('button', { name: 'Neues Rezept' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Name', { exact: true }).fill('Eierpfannkuchen');
  // Ei: startet mit 1 Ei M (52 g), per Stück zählbar
  await dlg.getByLabel('Zutat suchen').fill('Ei');
  await dlg.getByRole('button', { name: /^Ei \(Hühnerei\)/ }).click();
  const egg = dlg.getByTestId('ingredient').filter({ hasText: 'Ei (Hühnerei)' });
  await expect(egg.getByLabel('Einheit Ei (Hühnerei)')).toHaveValue('1');
  await egg.getByRole('button', { name: 'Anzahl Ei (Hühnerei) mehr' }).click();
  await egg.getByRole('button', { name: 'Anzahl Ei (Hühnerei) mehr' }).click();
  await expect(egg).toContainText('156 g');
  await egg.getByLabel('Einheit Ei (Hühnerei)').selectOption({ label: 'Ei L (60 g)' });
  await expect(egg).toContainText('180 g');
  // Mehl ist ein Grundnahrungsmittel
  await dlg.getByLabel('Zutat suchen').fill('Mehl');
  await dlg.getByRole('button', { name: /^Weizenmehl Type 405/ }).click();
  await dlg.getByLabel('Menge Weizenmehl Type 405 (g)').fill('200');
  await expect(dlg.getByTestId('recipe-summary')).toContainText('2 Zutaten · 380 g roh');
  // Fertiggewicht → Portion = Hälfte des Gerichts
  await dlg.getByLabel('Gewicht fertig (optional, g)').fill('500');
  await expect(dlg.getByTestId('recipe-summary')).toContainText('250 g je Portion');
  await page.waitForTimeout(300);
  await dlg.screenshot({ path: 'test-results/rezept-editor.png' });
  await dlg.getByRole('button', { name: /Rezept speichern/ }).click();
  await dismissCelebrations(page);
  // Buchen in Gramm
  await page.getByRole('button', { name: 'Ins Tagebuch' }).click();
  const log = page.getByRole('dialog');
  await log.getByRole('tab', { name: 'Gramm' }).click();
  await log.getByLabel('Gramm vom fertigen Gericht').fill('100');
  await expect(log.getByTestId('recipe-amount-preview')).toContainText('≈ 100 g');
  await log.getByRole('button', { name: 'Buchen' }).click();
  // Kopieren
  await page.getByRole('button', { name: 'Rezept kopieren' }).click();
  await expect(page.getByRole('dialog').getByLabel('Name', { exact: true })).toHaveValue('Eierpfannkuchen (Kopie)');
});

test('E2E-05 Navy-Berechnung → speichern → Verlauf', async ({ page }) => {
  await onboard(page);
  await nav(page, 'Körper');
  await page.getByRole('tab', { name: 'Navy-Rechner' }).click();
  await page.getByLabel('Halsumfang (cm)').fill('38');
  await page.getByLabel(/Bauchumfang/).fill('85');
  await page.getByRole('button', { name: 'Berechnen' }).click();
  await expect(page.getByTestId('navy-result')).toContainText('16,2 %');
  await expect(page.getByTestId('navy-result')).toContainText('Näherungswert');
  await page.getByRole('button', { name: 'Ergebnis speichern' }).click();
  await page.getByLabel(/Bauchumfang/).fill('84');
  await page.getByRole('button', { name: 'Berechnen' }).click();
  await page.getByRole('button', { name: 'Ergebnis speichern' }).click();
  await expect(page.getByText(/\(-0,\d\)/)).toBeVisible(); // Vergleich mit vorheriger Navy-Messung
  await page.getByRole('tab', { name: 'Messungen' }).click();
  await expect(page.getByTestId('measurement-list')).toContainText('Navy-Schätzung');
  // ungültige Eingabe
  await page.getByRole('tab', { name: 'Navy-Rechner' }).click();
  await page.getByLabel(/Bauchumfang/).fill('30');
  await page.getByRole('button', { name: 'Berechnen' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('E2E-06/07 Plan erstellen → aktivieren → Workout → Historie', async ({ page }) => {
  await onboard(page);
  await createAndActivatePlan(page);
  await nav(page, 'Heute');
  await expect(page.getByTestId('station-training')).toContainText('Tag A');
  await openStation(page, 'Übungsplatz');
  await expect(page.getByText('PPL Push · 2 Übungen')).toBeVisible();
  await page.getByRole('button', { name: 'Starten', exact: true }).click();
  await expect(page.getByTestId('workout-exercise')).toHaveCount(2);
  const first = page.getByTestId('workout-exercise').first();
  await expect(first.getByLabel('Satz 1 Gewicht')).toHaveValue('60');
  for (let i = 1; i <= 3; i++) {
    await first.getByLabel(`Satz ${i} Wiederholungen`).fill('10');
    await first.getByRole('button', { name: `Satz ${i} abschließen` }).click();
  }
  await expect(page.getByTestId('rest-remaining')).not.toHaveText('0:00');
  await page.getByRole('button', { name: 'Pause anhalten' }).click();
  const paused = await page.getByTestId('rest-remaining').textContent();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId('rest-remaining')).toHaveText(paused!); // angehalten
  await page.getByRole('button', { name: 'Pause zurücksetzen' }).click();
  await expect(page.getByTestId('rest-remaining')).toHaveText('1:30'); // zurückgesetzt auf die Pause der Übung (90 s)
  await page.getByRole('button', { name: 'Training abschließen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abschließen' }).click();
  await dismissCelebrations(page);
  await expect(page.getByTestId('detail-volume')).toHaveText('1.800');
  await nav(page, 'Training');
  await page.getByRole('tab', { name: 'Historie' }).click();
  await expect(page.getByTestId('history-list')).toContainText('PPL Push');
  // AK-067: Übungsverlauf grafisch
  await page.getByTestId('history-list').getByRole('button').first().click();
  await page.getByRole('button', { name: 'Bankdrücken (Langhantel)' }).click();
  await expect(page.getByText('Verlauf (1 Einheiten)')).toBeVisible();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
});

test('E2E-08 Workout → Trainingsenergie anrechnen → Tagesbudget', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/training');
  await page.getByRole('button', { name: 'Freies Training' }).click();
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  await page.getByRole('dialog').getByLabel('Übung suchen').fill('Kniebeuge (Langhantel)');
  await page.getByRole('dialog').getByRole('button', { name: /^Kniebeuge \(Langhantel\)/ }).click();
  const ex = page.getByTestId('workout-exercise').first();
  await ex.getByLabel('Satz 1 Gewicht').fill('100');
  await ex.getByLabel('Satz 1 Wiederholungen').fill('5');
  await ex.getByRole('button', { name: 'Satz 1 abschließen' }).click();
  await page.getByRole('button', { name: 'Training abschließen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abschließen' }).click();
  await dismissCelebrations(page);
  await page.getByText('Eigener kcal-Wert (z. B. von einer Pulsuhr)').click();
  await page.getByLabel('Eigener Wert (kcal)').fill('300');
  await page.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await page.goto('/#/settings');
  await page.getByRole('tab', { name: 'Energie' }).click();
  await page.getByRole('radio', { name: '100 %' }).click();
  await expect(page.getByTestId('credit-pct')).toHaveText('100 %');
  await page.goto('/#/');
  await openStation(page, 'Proviant');
  await expect(page.getByTestId('credited-kcal')).toHaveText('+300');
  await expect(page.getByTestId('remaining-kcal')).toHaveText('2.308');
  await page.goto('/#/settings');
  await page.getByRole('tab', { name: 'Energie' }).click();
  await page.getByRole('radio', { name: 'Keine' }).click();
  await page.goto('/#/');
  await expect(page.getByTestId('remaining-kcal')).toHaveText('2.008');
});

test('E2E-09 Daten ändern → Statistiken aktualisieren sich', async ({ page }) => {
  await onboard(page);
  await createCustomFood(page, 'Reis', 150, 3, 32, 0.5);
  await page.getByRole('tab', { name: 'Tagebuch' }).click();
  await page.getByRole('button', { name: 'Mittagessen: Lebensmittel hinzufügen' }).click();
  await page.getByRole('dialog').getByLabel('Lebensmittel suchen').fill('Reis');
  await page.getByRole('dialog').getByRole('button', { name: /^Reis.*Eigenes/ }).click();
  await page.getByRole('dialog').getByLabel('Menge').fill('1000');
  await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen' }).click();
  await page.getByTestId('add-done').click();
  await nav(page, 'Statistiken');
  await page.getByRole('tab', { name: '7 T' }).click();
  await expect(page.getByTestId('avg-kcal')).toHaveText('1.500');
  await nav(page, 'Ernährung');
  await page.getByTestId('meal-lunch').getByRole('button', { name: /Reis/ }).click();
  await page.getByRole('dialog').getByLabel(/Menge/).fill('500');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await nav(page, 'Statistiken');
  await expect(page.getByTestId('avg-kcal')).toHaveText('750');
  // Training ändern
  await page.goto('/#/training');
  await page.getByRole('button', { name: 'Freies Training' }).click();
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  await page.getByRole('dialog').getByLabel('Übung suchen').fill('Kreuzheben');
  await page.getByRole('dialog').getByRole('button', { name: /^Kreuzheben Rückseite/ }).click();
  const ex = page.getByTestId('workout-exercise').first();
  await ex.getByLabel('Satz 1 Gewicht').fill('100');
  await ex.getByLabel('Satz 1 Wiederholungen').fill('5');
  await ex.getByRole('button', { name: 'Satz 1 abschließen' }).click();
  await page.getByRole('button', { name: 'Training abschließen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abschließen' }).click();
  await dismissCelebrations(page);
  await nav(page, 'Statistiken');
  await page.getByRole('tab', { name: 'Training' }).click();
  await expect(page.getByTestId('total-volume')).toHaveText('500');
  await expect(page.getByTestId('sessions')).toHaveText('1');
  await page.goto('/#/training?tab=history');
  await page.getByTestId('history-list').getByRole('button').first().click();
  await page.getByRole('button', { name: 'Workout löschen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await nav(page, 'Statistiken');
  await page.getByRole('tab', { name: 'Training' }).click();
  await expect(page.getByTestId('sessions')).toHaveText('0');
});

test('E2E-10 Neuladen → Daten und laufendes Workout bleiben', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/training');
  await page.getByRole('button', { name: 'Freies Training' }).click();
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  await page.getByRole('dialog').getByLabel('Übung suchen').fill('Klimmzug');
  await page.getByRole('dialog').getByRole('button', { name: /^Klimmzug Latissimus/ }).click();
  const ex = page.getByTestId('workout-exercise').first();
  await ex.getByLabel('Satz 1 Gewicht').fill('10');
  await ex.getByLabel('Satz 1 Wiederholungen').fill('8');
  await ex.getByRole('button', { name: 'Satz 1 abschließen' }).click();
  await expect(ex.getByRole('button', { name: 'Satz 1 offen markieren' })).toBeVisible();
  // warten, bis der Zustand in IndexedDB festgeschrieben ist (Schreibvorgang läuft asynchron)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((res) => {
            const r = indexedDB.open('fitcore');
            r.onsuccess = () => {
              const g = r.result.transaction('activeWorkout').objectStore('activeWorkout').get('current');
              g.onsuccess = () => res(!!g.result?.exercises?.[0]?.sets?.[0]?.done);
            };
          }),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Freies Training' })).toBeVisible();
  const ex2 = page.getByTestId('workout-exercise').first();
  await expect(ex2.getByLabel('Satz 1 Gewicht')).toHaveValue('10');
  await expect(ex2.getByLabel('Satz 1 Wiederholungen')).toHaveValue('8');
  await expect(ex2.getByRole('button', { name: 'Satz 1 offen markieren' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('Hallo Giuliano')).toBeVisible();
  await expect(page.getByText(/Laufendes Workout: Freies Training/)).toBeVisible();
});

test('Barcode mit OFF-Produkt ohne Nährwerte → von der Packung ergänzen → nächster Scan findet eigene Werte', async ({ page }) => {
  await page.route('https://world.openfoodfacts.org/**', (r) =>
    r.fulfill({ json: { status: 1, product: { code: '4067796185676', product_name: 'Apfelchips', brands: 'dmBio', quantity: '63g', nutriments: {} } } }),
  );
  await onboard(page);
  await nav(page, 'Ernährung');
  await page.getByRole('button', { name: 'Snacks: Lebensmittel hinzufügen' }).click();
  await page.getByRole('button', { name: 'Barcode scannen' }).click();
  await page.getByLabel('Barcode manuell eingeben').fill('4067796185676');
  await page.getByRole('button', { name: 'Suchen' }).click();
  await expect(page.getByTestId('incomplete-hint')).toContainText('Keine Nährwerte hinterlegt');
  await page.getByRole('button', { name: 'Nährwerte von der Packung ergänzen' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByLabel('Name', { exact: true })).toHaveValue('Apfelchips');
  await expect(dlg.getByLabel('Barcode (optional)')).toHaveValue('4067796185676');
  await dlg.getByLabel('Kalorien (kcal)').fill('349');
  await dlg.getByLabel('Protein (g)').fill('2.7');
  await dlg.getByLabel('Kohlenhydrate (g)').fill('74');
  await dlg.getByLabel('Fett (g)').fill('0.8');
  await dlg.getByRole('button', { name: 'Speichern und auswählen' }).click();
  await expect(dlg.getByTestId('nut-kcal')).toHaveText('349 kcal'); // Mengenansicht mit eigenen Werten
  await expect(page.getByTestId('incomplete-hint')).toHaveCount(0);
  await dlg.getByRole('spinbutton', { name: 'Menge' }).fill('30');
  await dlg.getByRole('button', { name: 'Hinzufügen' }).click();
  await page.getByTestId('add-done').click();
  await expect(page.getByTestId('day-kcal')).toHaveText('105');
  // nächster Scan: eigene Werte, kein Hinweis
  await page.getByRole('button', { name: 'Snacks: Lebensmittel hinzufügen' }).click();
  await page.getByRole('button', { name: 'Barcode scannen' }).click();
  await page.getByLabel('Barcode manuell eingeben').fill('4067796185676');
  await page.getByRole('button', { name: 'Suchen' }).click();
  await expect(page.getByRole('dialog').getByTestId('nut-kcal')).toBeVisible();
  await expect(page.getByTestId('incomplete-hint')).toHaveCount(0);
});

test('Studio Vitova Nordenstadt: Heimstudio wählen → Vorlage übernehmen → Gerätefilter', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/settings');
  await page.getByRole('tab', { name: 'App' }).click();
  await page.getByLabel('Heimstudio').selectOption('vitova-nordenstadt');
  await page.goto('/#/training');
  await page.getByRole('button', { name: 'Aus Vorlage' }).click();
  await expect(page.getByTestId('template-list').getByRole('button').first()).toContainText('Vitova Medifit Nordenstadt');
  await page.getByRole('button', { name: /milon-Zirkel Ganzkörper/ }).click();
  await expect(page.getByTestId('plan-exercise')).toHaveCount(8);
  await expect(page.getByTestId('plan-exercise').first()).toContainText('milon Brustpresse');
  await page.getByRole('button', { name: 'Speichern & aktivieren' }).click();
  await expect(page.getByTestId('plan-card').first()).toContainText('aktiv');
  await page.getByRole('tab', { name: 'Übungen' }).click();
  await expect(page.getByRole('button', { name: 'Nur Vitova Medifit Nordenstadt' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Gerät / Equipment').selectOption('Technogym Selection');
  await expect(page.getByTestId('exercise-list')).toContainText('Beinpresse (Technogym Selection)');
  await expect(page.getByTestId('exercise-list')).not.toContainText('Kniebeuge (Langhantel)');
});

test('AK-108 Essen eintragen: Suche oben, Reis gekocht umrechnen, mehrere Einträge am Stück, „wie zuletzt“', async ({ page }) => {
  await onboard(page);
  await nav(page, 'Ernährung');
  await page.getByRole('button', { name: 'Mittagessen: Lebensmittel hinzufügen' }).click();
  const dlg = page.getByRole('dialog');
  // Suchfeld sitzt oben im Blatt
  const box = await dlg.getByLabel('Lebensmittel suchen').boundingBox();
  const vh = page.viewportSize()!.height;
  expect(box!.y).toBeLessThan(vh * 0.35);
  // Grundnahrungsmittel offline: Reis trocken → gekocht gewogen
  await dlg.getByLabel('Lebensmittel suchen').fill('reis');
  await dlg.getByTestId('local-results').getByRole('button', { name: /^Reis, weiß/ }).click();
  await expect(dlg.getByRole('group', { name: 'Zubereitung' }).getByRole('button', { name: 'trocken' })).toHaveAttribute('aria-pressed', 'true');
  await dlg.getByRole('group', { name: 'Zubereitung' }).getByRole('button', { name: 'gekocht' }).click();
  await expect(dlg.getByTestId('prep-hint')).toContainText('2,8 ×');
  await dlg.getByRole('group', { name: 'Schnellauswahl' }).getByRole('button', { name: '250 g' }).click();
  // 355 kcal trocken / 2,8 = 126,79 kcal pro 100 g gekocht → 250 g = 317 kcal
  await expect(dlg.getByTestId('nut-kcal')).toHaveText('317 kcal');
  await dlg.getByRole('button', { name: /Hinzufügen/ }).click();
  // Blatt bleibt offen für das nächste Lebensmittel
  await expect(dlg.getByTestId('added-list')).toContainText('1 zu Mittagessen hinzugefügt');
  await dlg.getByLabel('Lebensmittel suchen').fill('hähnchen');
  await dlg.getByTestId('local-results').getByRole('button', { name: /^Hähnchenbrust/ }).click();
  await dlg.getByRole('group', { name: 'Zubereitung' }).getByRole('button', { name: 'gebraten/gegart' }).click();
  await dlg.getByLabel('Menge').fill('150');
  await dlg.getByRole('button', { name: /Hinzufügen/ }).click();
  await expect(dlg.getByTestId('added-list')).toContainText('2 zu Mittagessen hinzugefügt');
  await dlg.getByTestId('add-done').click();
  await expect(page.getByTestId('meal-lunch')).toContainText('250 g gekocht');
  await expect(page.getByTestId('meal-lunch')).toContainText('150 g gebraten/gegart');
  // Abendessen: Reis „wie zuletzt“ mit einem Tipp
  await page.getByRole('button', { name: 'Abendessen: Lebensmittel hinzufügen' }).click();
  await dlg.getByRole('button', { name: /Reis, weiß.*wie zuletzt \(250 g gekocht\)/ }).click();
  await dlg.getByTestId('add-done').click();
  await expect(page.getByTestId('meal-dinner')).toContainText('250 g gekocht');
});
