// Gemeinsame Energiebilanz aus Ernährung und Training.
import type { CardioSession, GoalVersion, Workout } from './types';
import { ValidationError } from './energy';

export interface TrainingEnergyItem {
  id: string;
  kind: 'workout' | 'cardio';
  label: string;
  kcal: number; // geschätzt bzw. vom Nutzer überschrieben
  estimated: boolean;
}

export function sessionKcal(s: { estimatedKcal: number; kcalOverride?: number }): number {
  return s.kcalOverride != null ? s.kcalOverride : s.estimatedKcal;
}

/** Eindeutige Trainingsenergie eines Tages – Duplikate (gleiche ID) werden nur einmal gezählt. */
export function trainingEnergyItems(workouts: Workout[], cardio: CardioSession[]): TrainingEnergyItem[] {
  const seen = new Set<string>();
  const items: TrainingEnergyItem[] = [];
  for (const w of workouts) {
    if (seen.has('w:' + w.id)) continue;
    seen.add('w:' + w.id);
    items.push({ id: w.id, kind: 'workout', label: w.name, kcal: sessionKcal(w), estimated: w.kcalOverride == null });
  }
  for (const c of cardio) {
    if (seen.has('c:' + c.id)) continue;
    seen.add('c:' + c.id);
    items.push({ id: c.id, kind: 'cardio', label: c.customName || c.activity, kcal: sessionKcal(c), estimated: c.kcalOverride == null });
  }
  return items;
}

export interface CreditSettings {
  creditPct: number; // 0–100
  activityIncludesTraining: boolean;
  includedTrainingKcal: number; // bereits im Aktivitätsfaktor enthaltene kcal pro Trainingstag
}

export interface CreditResult {
  rawKcal: number;
  alreadyIncludedKcal: number;
  creditableKcal: number;
  creditedKcal: number;
}

/**
 * Anrechenbare Trainingsenergie:
 *  creditable = max(0, Σ Trainings-kcal − bereits im Aktivitätsfaktor enthaltene kcal)
 *  credited   = creditable · Quote
 */
export function creditTrainingEnergy(items: TrainingEnergyItem[], s: CreditSettings): CreditResult {
  if (!(s.creditPct >= 0 && s.creditPct <= 100)) throw new ValidationError('Anrechnungsquote muss zwischen 0 und 100 % liegen.');
  const raw = items.reduce((a, i) => a + Math.max(0, i.kcal), 0);
  const included = s.activityIncludesTraining && raw > 0 ? Math.max(0, s.includedTrainingKcal) : 0;
  const creditable = Math.max(0, raw - included);
  return {
    rawKcal: Math.round(raw),
    alreadyIncludedKcal: Math.round(Math.min(raw, included)),
    creditableKcal: Math.round(creditable),
    creditedKcal: Math.round((creditable * s.creditPct) / 100),
  };
}

export interface DayBudget {
  target: number;
  eaten: number;
  credited: number;
  remaining: number;
}

/** Verbleibend = Ziel + anerkannte Trainingsenergie − Gegessenes. */
export function dayBudget(target: number, eaten: number, credited: number): DayBudget {
  return { target, eaten: Math.round(eaten), credited, remaining: Math.round(target + credited - eaten) };
}

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** zusätzliche Gramm durch Training */
  extra: { proteinG: number; carbsG: number; fatG: number };
}

/**
 * Makroziele eines Trainingstags: die angerechneten Trainings-kcal werden verteilt – 70 % Kohlenhydrate
 * (Energie fürs Training), 15 % Protein (Regeneration), 15 % Fett.
 */
export function trainingDayMacros(goal: Pick<GoalVersion, 'proteinG' | 'carbsG' | 'fatG'>, creditedKcal: number): MacroTargets {
  const k = Math.max(0, creditedKcal);
  const extra = { proteinG: Math.round((k * 0.15) / 4), carbsG: Math.round((k * 0.7) / 4), fatG: Math.round((k * 0.15) / 9) };
  return { proteinG: goal.proteinG + extra.proteinG, carbsG: goal.carbsG + extra.carbsG, fatG: goal.fatG + extra.fatG, extra };
}

/** Ziel, das an einem Datum galt (letzte Version mit effectiveFrom ≤ Datum). */
export function goalForDate(goals: GoalVersion[], date: string): GoalVersion | undefined {
  let found: GoalVersion | undefined;
  for (const g of goals) {
    if (g.effectiveFrom <= date && (!found || g.effectiveFrom > found.effectiveFrom || (g.effectiveFrom === found.effectiveFrom && (g.id ?? 0) > (found.id ?? 0)))) found = g;
  }
  return found;
}
