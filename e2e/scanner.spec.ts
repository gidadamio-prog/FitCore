import { expect, test } from '@playwright/test';

// Kamerascanner mit simulierter Kamera (Chrome --use-file-for-fake-video-capture). Wird nur ausgeführt,
// wenn die Videodatei existiert (siehe scripts/make-barcode-video.sh).
import fs from 'node:fs';
const video = process.env.BARCODE_Y4M ?? 'e2e/.fixtures/barcode.y4m';

test.use({
  permissions: ['camera'],
  launchOptions: {
    executablePath: process.env.PW_CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
  },
});

test('AK-019 Kamerascanner erkennt einen gültigen EAN-13', async ({ page }) => {
  test.skip(!fs.existsSync(video), 'Keine Testvideo-Datei vorhanden');
  await page.goto('/');
  await page.evaluate(async () => {
    // Scanner-Komponente isoliert öffnen: Onboarding überspringen ist nicht nötig – wir nutzen die Testseite
  });
  await page.goto('/#/');
  // Minimal-Onboarding
  await page.getByLabel('Name', { exact: true }).fill('Scan');
  await page.getByLabel('Geburtsdatum').fill('1990-01-01');
  await page.getByLabel(/Geschlecht/).selectOption('female');
  await page.getByLabel('Größe (cm)').fill('170');
  await page.getByLabel('Gewicht (kg)').fill('65');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Profil anlegen' }).click();
  await page.route('https://world.openfoodfacts.org/**', (r) => r.fulfill({ json: { status: 0 } }));
  await page.getByRole('button', { name: 'Lebensmittel' }).first().click();
  await page.getByRole('button', { name: 'Barcode scannen' }).click();
  await page.getByRole('button', { name: 'Kamera starten' }).click();
  await expect(page.getByRole('dialog')).toContainText(/nicht gefunden/, { timeout: 20000 });
  await expect(page.getByRole('dialog').getByLabel('Barcode (optional)')).toHaveValue('4006381333931');
});
