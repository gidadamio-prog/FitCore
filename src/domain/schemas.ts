// Zod-Schemas für Eingabevalidierung mit verständlichen deutschen Fehlermeldungen.
import { z } from 'zod';

const num = (label: string, min: number, max: number) =>
  z.number({ message: `${label} ist erforderlich.` }).refine((v) => Number.isFinite(v), `${label} ist keine gültige Zahl.`).refine((v) => v >= min && v <= max, `${label} muss zwischen ${min} und ${max} liegen.`);

const optNum = (label: string, min: number, max: number) => num(label, min, max).optional();

export const profileSchema = z.object({
  name: z.string({ message: 'Bitte gib einen Namen ein.' }).trim().min(1, 'Bitte gib einen Namen ein.').max(60, 'Name ist zu lang.'),
  birthDate: z
    .string({ message: 'Bitte ein gültiges Geburtsdatum angeben.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte ein gültiges Geburtsdatum angeben.')
    .refine((d) => {
      const age = (Date.now() - new Date(d + 'T00:00:00').getTime()) / (365.2425 * 86400000);
      return age >= 18 && age <= 110;
    }, 'Die automatischen Berechnungen sind für Erwachsene (18–110 Jahre) ausgelegt.'),
  sex: z.enum(['male', 'female'], { message: 'Bitte die für die Formeln nötige Angabe wählen.' }),
  heightCm: num('Körpergröße (cm)', 120, 250),
  weightKg: num('Gewicht (kg)', 30, 350),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  trainingDaysPerWeek: num('Trainingstage pro Woche', 0, 14),
  bodyFatPct: optNum('Körperfett (%)', 3, 70),
  dietPreference: z.string().max(60),
  equipment: z.array(z.string()),
  specialSituation: z.enum(['none', 'pregnant', 'breastfeeding', 'medical']),
  targetWeightKg: optNum('Zielgewicht (kg)', 30, 350),
});
export type ProfileForm = z.infer<typeof profileSchema>;

export const goalSchema = z.object({
  primaryGoal: z.enum(['lose_weight', 'reduce_fat', 'maintain', 'build_muscle', 'recomp', 'strength', 'endurance', 'general']),
  secondaryGoals: z.array(z.enum(['lose_weight', 'reduce_fat', 'maintain', 'build_muscle', 'recomp', 'strength', 'endurance', 'general'])),
  weeklyRateKg: num('Wöchentliche Veränderung (kg)', -1.5, 1.5),
  macroStrategy: z.enum(['balanced', 'low_carb', 'high_carb', 'high_protein']),
  formula: z.enum(['mifflin', 'katch']),
});

export const manualTargetsSchema = z.object({
  calorieTarget: num('Kalorienziel', 1000, 6000),
  proteinG: num('Protein (g)', 0, 500),
  carbsG: num('Kohlenhydrate (g)', 0, 1000),
  fatG: num('Fett (g)', 0, 400),
});

export const measurementSchema = z
  .object({
    date: z.string({ message: 'Bitte ein Datum angeben.' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte ein Datum angeben.'),
    weightKg: optNum('Gewicht (kg)', 30, 350),
    heightCm: optNum('Größe (cm)', 120, 250),
    bodyFatPct: optNum('Körperfett (%)', 2, 70),
    muscleMassKg: optNum('Muskelmasse (kg)', 5, 150),
    abdomenCm: optNum('Bauch (cm)', 40, 200),
    waistCm: optNum('Taille (cm)', 40, 200),
    hipCm: optNum('Hüfte (cm)', 50, 200),
    neckCm: optNum('Hals (cm)', 20, 70),
    chestCm: optNum('Brust (cm)', 50, 200),
    armCm: optNum('Oberarm (cm)', 15, 70),
    thighCm: optNum('Oberschenkel (cm)', 25, 120),
    custom: z.record(z.string(), z.number()).optional(),
    note: z.string().max(500).optional(),
  })
  .refine((m) => Object.entries(m).some(([k, v]) => k !== 'date' && k !== 'note' && v !== undefined && (k !== 'custom' || Object.keys(v as object).length > 0)), {
    message: 'Bitte mindestens einen Messwert eingeben.',
  });

const nutr = (label: string, max: number) => z.number().min(0, `${label} darf nicht negativ sein.`).max(max, `${label} ist unplausibel hoch.`).nullable();

export const customFoodSchema = z
  .object({
    name: z.string({ message: 'Bitte einen Namen angeben.' }).trim().min(1, 'Bitte einen Namen angeben.').max(120),
    brand: z.string().max(80).optional(),
    barcode: z.string().regex(/^\d{8,14}$/, 'Barcode muss 8–14 Ziffern haben.').optional(),
    unitBase: z.enum(['g', 'ml'], { message: 'Bitte Bezugsmenge wählen.' }),
    kcal: nutr('Kalorien', 900),
    protein: nutr('Protein', 100),
    carbs: nutr('Kohlenhydrate', 100),
    fat: nutr('Fett', 100),
    fiber: nutr('Ballaststoffe', 100).optional(),
    sugar: nutr('Zucker', 100).optional(),
    salt: nutr('Salz', 100).optional(),
    servingLabel: z.string().max(40).optional(),
    servingGrams: z.number().positive('Portionsgröße muss größer als 0 sein.').max(5000).optional(),
  })
  .refine((f) => f.kcal != null, { message: 'Kalorien sind für eigene Lebensmittel erforderlich.', path: ['kcal'] })
  .refine((f) => (f.protein ?? 0) + (f.carbs ?? 0) + (f.fat ?? 0) <= 100.5, { message: 'Summe aus Protein, Kohlenhydraten und Fett kann 100 g pro 100 g nicht überschreiten.', path: ['fat'] });

export const amountSchema = num('Menge', 0.1, 10000);

export function firstError(e: unknown): string {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? 'Ungültige Eingabe.';
  if (e instanceof Error) return e.message;
  return 'Unbekannter Fehler.';
}

export function fieldErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = String(i.path[0] ?? '_');
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Minimale Strukturprüfung eines Backups. */
export const backupSchema = z.object({
  app: z.literal('fitcore'),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.string(),
  tables: z.record(z.string(), z.array(z.unknown())),
});
