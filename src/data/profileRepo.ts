import type { Hero, ShareCard } from '@/domain/rpg';
import { db } from './db';
import type { GoalType, GoalVersion, MacroStrategy, BmrFormula, Profile, Setting } from '@/domain/types';
import { ageFromBirthDate, computeTargets, defaultWeeklyRate } from '@/domain/energy';
import { profileSchema, type ProfileForm } from '@/domain/schemas';
import { nowISO, today, uid } from '@/domain/dates';
import { EXERCISE_LIBRARY, LIBRARY_VERSION } from './exerciseLibrary';
import { goalForDate } from '@/domain/balance';

export async function getProfile(): Promise<Profile | undefined> {
  return db.profile.get('me');
}

export async function latestWeight(): Promise<number | undefined> {
  const all = await db.measurements.orderBy('date').reverse().toArray();
  return all.find((m) => m.weightKg != null)?.weightKg;
}

export interface GoalChoice {
  primaryGoal: GoalType;
  secondaryGoals: GoalType[];
  weeklyRateKg?: number;
  macroStrategy: MacroStrategy;
  formula: BmrFormula;
}

/** Berechnet Ziele aus Profil + Gewicht. */
export function deriveGoal(p: Pick<Profile, 'birthDate' | 'sex' | 'heightCm' | 'activityLevel' | 'bodyFatPct' | 'specialSituation'>, weightKg: number, choice: GoalChoice) {
  const rate = choice.weeklyRateKg ?? defaultWeeklyRate(choice.primaryGoal, weightKg);
  const r = computeTargets({
    weightKg,
    heightCm: p.heightCm,
    age: ageFromBirthDate(p.birthDate),
    sex: p.sex,
    activityLevel: p.activityLevel,
    bodyFatPct: p.bodyFatPct,
    formula: choice.formula,
    goal: choice.primaryGoal,
    weeklyRateKg: rate,
    strategy: choice.macroStrategy,
    specialSituation: p.specialSituation,
  });
  return { ...r, weeklyRateKg: p.specialSituation !== 'none' && rate < 0 ? 0 : rate };
}

/** Legt eine neue Zielversion an (Historie bleibt erhalten). */
export async function addGoalVersion(g: Omit<GoalVersion, 'id' | 'createdAt' | 'effectiveFrom'> & { effectiveFrom?: string }): Promise<number> {
  return db.goals.add({ ...g, effectiveFrom: g.effectiveFrom ?? today(), createdAt: nowISO() });
}

export async function currentGoal(date = today()): Promise<GoalVersion | undefined> {
  return goalForDate(await db.goals.toArray(), date);
}

export async function completeOnboarding(form: ProfileForm, choice: GoalChoice, extras: Partial<Profile> = {}) {
  const parsed = profileSchema.parse(form);
  const ts = nowISO();
  const profile: Profile = {
    id: 'me',
    name: parsed.name,
    birthDate: parsed.birthDate,
    sex: parsed.sex,
    heightCm: parsed.heightCm,
    activityLevel: parsed.activityLevel,
    experience: parsed.experience,
    trainingDaysPerWeek: parsed.trainingDaysPerWeek,
    bodyFatPct: parsed.bodyFatPct,
    dietPreference: parsed.dietPreference,
    equipment: parsed.equipment,
    specialSituation: parsed.specialSituation,
    targetWeightKg: parsed.targetWeightKg,
    activityIncludesTraining: false,
    includedTrainingKcal: 0,
    trainingCreditPct: 50,
    createdAt: ts,
    updatedAt: ts,
    ...extras,
  };
  const g = deriveGoal(profile, parsed.weightKg, choice);
  await db.transaction('rw', [db.profile, db.goals, db.measurements], async () => {
    await db.profile.put(profile);
    await db.measurements.add({
      id: uid(),
      date: today(),
      weightKg: parsed.weightKg,
      heightCm: parsed.heightCm,
      bodyFatPct: parsed.bodyFatPct,
      bodyFatMethod: parsed.bodyFatPct != null ? 'manual' : undefined,
      createdAt: ts,
      updatedAt: ts,
    });
    await db.goals.add({
      effectiveFrom: today(),
      primaryGoal: choice.primaryGoal,
      secondaryGoals: choice.secondaryGoals,
      weeklyRateKg: g.weeklyRateKg,
      macroStrategy: choice.macroStrategy,
      formula: g.formula,
      bmr: g.bmr,
      tdee: g.tdee,
      adjustmentKcal: g.adjustmentKcal,
      calorieTarget: g.calorieTarget,
      proteinG: g.proteinG,
      carbsG: g.carbsG,
      fatG: g.fatG,
      manualCalories: false,
      manualMacros: false,
      reason: 'Onboarding',
      createdAt: ts,
    });
  });
  return { profile, goal: g };
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id' | 'createdAt'>>) {
  const p = await getProfile();
  if (!p) throw new Error('Kein Profil vorhanden.');
  const next = { ...p, ...patch, updatedAt: nowISO() };
  profileSchema.partial().parse({ ...next, weightKg: undefined });
  await db.profile.put(next);
  return next;
}

export async function ensureSeed() {
  const v = await db.settings.get('libraryVersion');
  const count = await db.exercises.where('isCustom').equals(0).count();
  if ((v?.value as number | undefined) !== LIBRARY_VERSION || count < EXERCISE_LIBRARY.length) {
    await db.exercises.bulkPut(EXERCISE_LIBRARY);
    await db.settings.put({ key: 'libraryVersion', value: LIBRARY_VERSION });
  }
}

// ---------- Einstellungen ----------

export interface MealDef {
  id: string;
  label: string;
}

export const DEFAULT_MEAL_DEFS: MealDef[] = [
  { id: 'breakfast', label: 'Frühstück' },
  { id: 'lunch', label: 'Mittagessen' },
  { id: 'dinner', label: 'Abendessen' },
  { id: 'snack', label: 'Snacks' },
];

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  waterGoalMl: number;
  customMeals: MealDef[];
  usdaApiKey: string;
  externalSearchConsent: boolean;
  /** Heimstudio für den Geräte-Filter, '' = keins */
  homeGym: string;
  /** Anteil je Mahlzeit am Tagesziel in %, leer = Standardaufteilung */
  mealSplit: Record<string, number>;
  /** RPG-Held (null = noch nicht erstellt) */
  hero: Hero | null;
  /** Geteilte Werte von Freunden (nur Spielwerte, keine Körperdaten) */
  rivals: Rival[];
  /** Gekaufte Markt-Gegenstände (IDs) */
  purchases: string[];
  /** Animationen reduzieren */
  reduceMotion: boolean;
  /** Tägliches Schrittziel */
  stepGoal: number;
  /** Gewählte Wochen-Feldzüge je Woche (Montag → Quest-IDs) */
  questPicks: Record<string, string[]>;
  /** Zeitpunkt des letzten Backups (ISO) */
  lastBackupAt: string | null;
  /** Backup-Erinnerung bis zu diesem Tag ausblenden */
  backupSnoozeUntil: string | null;
}

export type Rival = ShareCard & { importedAt: string };

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  waterGoalMl: 2500,
  customMeals: [],
  usdaApiKey: '',
  externalSearchConsent: true,
  homeGym: '',
  mealSplit: {},
  hero: null,
  rivals: [],
  purchases: [],
  reduceMotion: false,
  stepGoal: 8000,
  questPicks: {},
  lastBackupAt: null,
  backupSnoozeUntil: null,
};

export async function getSettings(): Promise<AppSettings> {
  const rows: Setting[] = await db.settings.toArray();
  const out: AppSettings = { ...DEFAULT_SETTINGS };
  for (const r of rows) (out as unknown as Record<string, unknown>)[r.key] = r.value;
  return out;
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  await db.settings.put({ key, value });
}
