// Energiebedarf & Makronährstoffe. Alle Funktionen sind rein und getestet (tests/domain/energy.test.ts).
import type { ActivityLevel, BmrFormula, GoalType, MacroStrategy, Sex, SpecialSituation } from './types';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sitzend (kaum Bewegung)',
  light: 'Leicht aktiv',
  moderate: 'Mäßig aktiv',
  active: 'Sehr aktiv',
  very_active: 'Extrem aktiv',
};

export const GOAL_LABELS: Record<GoalType, string> = {
  lose_weight: 'Abnehmen',
  reduce_fat: 'Körperfett reduzieren',
  maintain: 'Gewicht halten',
  build_muscle: 'Muskelaufbau',
  recomp: 'Körperrekomposition',
  strength: 'Kraft steigern',
  endurance: 'Ausdauer verbessern',
  general: 'Allgemeine Fitness',
};

export const KCAL_PER_KG_BODY_MASS = 7700; // Näherung, dokumentiert in CALCULATION_RULES.md

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function assertRange(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ValidationError(`${label} muss zwischen ${min} und ${max} liegen.`);
  }
}

export function ageFromBirthDate(birthDate: string, on: Date = new Date()): number {
  const b = new Date(birthDate + 'T00:00:00');
  if (Number.isNaN(b.getTime())) throw new ValidationError('Ungültiges Geburtsdatum.');
  let age = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--;
  return age;
}

/** Mifflin-St Jeor: 10·kg + 6,25·cm − 5·Jahre + 5 (Männer) bzw. −161 (Frauen). */
export function bmrMifflin(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  assertRange(weightKg, 30, 350, 'Gewicht (kg)');
  assertRange(heightCm, 120, 250, 'Größe (cm)');
  assertRange(age, 18, 110, 'Alter');
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/** Katch-McArdle: 370 + 21,6 · fettfreie Masse (kg). Nur bei bekanntem Körperfett. */
export function bmrKatch(weightKg: number, bodyFatPct: number): number {
  assertRange(weightKg, 30, 350, 'Gewicht (kg)');
  assertRange(bodyFatPct, 3, 70, 'Körperfett (%)');
  const lbm = weightKg * (1 - bodyFatPct / 100);
  return 370 + 21.6 * lbm;
}

export function tdee(bmr: number, level: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[level];
}

export interface CalorieGoalInput {
  bmr: number;
  tdee: number;
  goal: GoalType;
  weeklyRateKg: number; // negativ = Abnahme, positiv = Zunahme
  sex: Sex;
  specialSituation: SpecialSituation;
}

export interface CalorieGoalResult {
  adjustmentKcal: number;
  calorieTarget: number;
  warnings: string[];
  deficitAllowed: boolean;
}

export const MIN_KCAL: Record<Sex, number> = { male: 1500, female: 1200 };
export const MAX_DEFICIT_FRACTION = 0.25;
export const MAX_DEFICIT_KCAL = 1000;
export const MAX_SURPLUS_KCAL = 500;

const DEFICIT_GOALS: GoalType[] = ['lose_weight', 'reduce_fat'];

export function defaultWeeklyRate(goal: GoalType, weightKg: number): number {
  switch (goal) {
    case 'lose_weight':
    case 'reduce_fat':
      return -round1(weightKg * 0.005); // 0,5 % KG/Woche
    case 'recomp':
      return -round1(weightKg * 0.0015);
    case 'build_muscle':
      return round1(weightKg * 0.0025);
    case 'strength':
      return round1(weightKg * 0.001);
    default:
      return 0;
  }
}

/** Kalorienziel mit Sicherheitsgrenzen. Empfiehlt nie extreme Defizite. */
export function calorieGoal(input: CalorieGoalInput): CalorieGoalResult {
  const warnings: string[] = [];
  const deficitAllowed = input.specialSituation === 'none';
  let rate = input.weeklyRateKg;
  if (!Number.isFinite(rate)) throw new ValidationError('Wöchentliche Rate ungültig.');
  if (Math.abs(rate) > 1.5) throw new ValidationError('Wöchentliche Veränderung muss zwischen −1,5 und +1,5 kg liegen.');

  if (!deficitAllowed && rate < 0) {
    warnings.push(
      'Wegen der angegebenen besonderen Situation (z. B. Schwangerschaft, Stillzeit, medizinische Gründe) werden keine automatischen Abnehmvorgaben berechnet. Bitte stimme Ernährungsziele mit Ärztin/Arzt oder Ernährungsfachkraft ab.',
    );
    rate = 0;
  }
  if (DEFICIT_GOALS.includes(input.goal) && rate > 0) rate = 0;

  let adjustment = (rate * KCAL_PER_KG_BODY_MASS) / 7;

  if (adjustment < 0) {
    const maxDeficit = Math.min(MAX_DEFICIT_KCAL, input.tdee * MAX_DEFICIT_FRACTION);
    if (-adjustment > maxDeficit) {
      warnings.push(`Defizit auf ${Math.round(maxDeficit)} kcal begrenzt (max. 25 % des Bedarfs bzw. 1000 kcal).`);
      adjustment = -maxDeficit;
    }
    const floor = Math.max(MIN_KCAL[input.sex], input.bmr * 0.9);
    if (input.tdee + adjustment < floor) {
      warnings.push(`Kalorienziel auf Untergrenze ${Math.round(floor)} kcal angehoben.`);
      adjustment = Math.min(0, floor - input.tdee);
    }
  } else if (adjustment > MAX_SURPLUS_KCAL) {
    warnings.push(`Überschuss auf ${MAX_SURPLUS_KCAL} kcal begrenzt.`);
    adjustment = MAX_SURPLUS_KCAL;
  }

  const target = Math.round(input.tdee + adjustment);
  return { adjustmentKcal: Math.round(adjustment), calorieTarget: target, warnings, deficitAllowed };
}

export interface MacroInput {
  calorieTarget: number;
  weightKg: number;
  goal: GoalType;
  strategy: MacroStrategy;
}

export interface MacroResult {
  proteinG: number;
  fatG: number;
  carbsG: number;
  warnings: string[];
}

export const PROTEIN_G_PER_KG: Record<GoalType, number> = {
  lose_weight: 2.0,
  reduce_fat: 2.0,
  recomp: 2.0,
  build_muscle: 1.8,
  strength: 1.8,
  maintain: 1.6,
  endurance: 1.6,
  general: 1.6,
};

const FAT_SHARE: Record<MacroStrategy, number> = {
  balanced: 0.3,
  low_carb: 0.4,
  high_carb: 0.2,
  high_protein: 0.28,
};

export function macroTargets(input: MacroInput): MacroResult {
  const warnings: string[] = [];
  assertRange(input.calorieTarget, 800, 8000, 'Kalorienziel');
  assertRange(input.weightKg, 30, 350, 'Gewicht (kg)');
  let proteinPerKg = PROTEIN_G_PER_KG[input.goal];
  if (input.strategy === 'high_protein') proteinPerKg += 0.3;
  const protein = Math.round(input.weightKg * proteinPerKg);
  const minFat = Math.round(input.weightKg * 0.6);
  let fat = Math.max(minFat, Math.round((input.calorieTarget * FAT_SHARE[input.strategy]) / 9));
  let carbs = Math.round((input.calorieTarget - protein * 4 - fat * 9) / 4);
  if (carbs < 0) {
    fat = minFat;
    carbs = Math.max(0, Math.round((input.calorieTarget - protein * 4 - fat * 9) / 4));
    warnings.push('Kalorienziel ist für Protein- und Mindestfettbedarf sehr knapp.');
  }
  return { proteinG: protein, fatG: fat, carbsG: carbs, warnings };
}

export function macroKcal(proteinG: number, carbsG: number, fatG: number): number {
  return proteinG * 4 + carbsG * 4 + fatG * 9;
}

/** Prüft, ob die Makro-Kaloriensumme zum Kalorienziel passt (Toleranz in kcal). */
export function macroConsistency(target: number, proteinG: number, carbsG: number, fatG: number, toleranceKcal = 25) {
  const sum = macroKcal(proteinG, carbsG, fatG);
  const diff = Math.round(sum - target);
  return { sum, diff, consistent: Math.abs(diff) <= toleranceKcal };
}

export interface FullGoalInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  bodyFatPct?: number;
  formula: BmrFormula;
  goal: GoalType;
  weeklyRateKg: number;
  strategy: MacroStrategy;
  specialSituation: SpecialSituation;
}

export function computeTargets(i: FullGoalInput) {
  const bmr =
    i.formula === 'katch' && i.bodyFatPct != null
      ? bmrKatch(i.weightKg, i.bodyFatPct)
      : bmrMifflin(i.weightKg, i.heightCm, i.age, i.sex);
  const usedFormula: BmrFormula = i.formula === 'katch' && i.bodyFatPct != null ? 'katch' : 'mifflin';
  const t = tdee(bmr, i.activityLevel);
  const cal = calorieGoal({ bmr, tdee: t, goal: i.goal, weeklyRateKg: i.weeklyRateKg, sex: i.sex, specialSituation: i.specialSituation });
  const macros = macroTargets({ calorieTarget: cal.calorieTarget, weightKg: i.weightKg, goal: i.goal, strategy: i.strategy });
  return {
    formula: usedFormula,
    bmr: Math.round(bmr),
    tdee: Math.round(t),
    adjustmentKcal: cal.adjustmentKcal,
    calorieTarget: cal.calorieTarget,
    proteinG: macros.proteinG,
    carbsG: macros.carbsG,
    fatG: macros.fatG,
    warnings: [...cal.warnings, ...macros.warnings],
  };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
