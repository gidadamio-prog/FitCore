// Zentrale Domänentypen von FitCore. Reine Typen – keine UI- oder DB-Abhängigkeiten.

export type Sex = 'male' | 'female';

export type GoalType =
  | 'lose_weight'
  | 'reduce_fat'
  | 'maintain'
  | 'build_muscle'
  | 'recomp'
  | 'strength'
  | 'endurance'
  | 'general';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type MacroStrategy = 'balanced' | 'low_carb' | 'high_carb' | 'high_protein';
export type SpecialSituation = 'none' | 'pregnant' | 'breastfeeding' | 'medical';
export type BmrFormula = 'mifflin' | 'katch';

export interface Profile {
  id: 'me';
  name: string;
  birthDate: string; // YYYY-MM-DD
  sex: Sex;
  heightCm: number;
  activityLevel: ActivityLevel;
  experience: Experience;
  trainingDaysPerWeek: number;
  bodyFatPct?: number;
  dietPreference: string;
  equipment: string[];
  specialSituation: SpecialSituation;
  targetWeightKg?: number;
  /** Ist Training bereits im Aktivitätsfaktor enthalten? */
  activityIncludesTraining: boolean;
  /** kcal pro Trainingstag, die laut Nutzer bereits im Aktivitätsfaktor stecken. */
  includedTrainingKcal: number;
  /** Anrechnungsquote 0–100 % */
  trainingCreditPct: number;
  createdAt: string;
  updatedAt: string;
}

/** Versioniertes Ziel – jede Änderung erzeugt eine neue Version, alte bleiben gültig für frühere Tage. */
export interface GoalVersion {
  id?: number;
  effectiveFrom: string; // YYYY-MM-DD
  primaryGoal: GoalType;
  secondaryGoals: GoalType[];
  weeklyRateKg: number; // gewünschte Veränderung/Woche (negativ = Abnahme)
  macroStrategy: MacroStrategy;
  formula: BmrFormula;
  bmr: number;
  tdee: number;
  adjustmentKcal: number; // Defizit (<0) bzw. Überschuss (>0)
  calorieTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  manualCalories: boolean;
  manualMacros: boolean;
  reason: string;
  createdAt: string;
}

/** Nährwerte. null = unbekannt (niemals erfunden). */
export interface Nutrients {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber?: number | null;
  sugar?: number | null;
  salt?: number | null;
  satFat?: number | null;
}

export type FoodSource = 'off' | 'usda' | 'custom' | 'basic';

export interface Serving {
  label: string;
  grams: number;
  /** zählbares Stück (Ei, Banane, Zwiebel …) – im Rezept per Anzahl wählbar */
  piece?: boolean;
}

export interface FoodItem {
  id: string; // z. B. off:3017624010701, usda:12345, custom:uuid
  name: string;
  brand?: string;
  barcode?: string;
  source: FoodSource;
  sourceId?: string;
  sourceUrl?: string;
  license?: string;
  unitBase: 'g' | 'ml';
  per100: Nutrients;
  /** Kalorien laut Etikett vs. aus Makros berechnet */
  kcalOrigin: 'label' | 'computed' | 'unknown';
  servings: Serving[];
  imageUrl?: string;
  favorite: 0 | 1;
  useCount: number;
  lastUsedAt?: string;
  fetchedAt?: string;
  createdAt: string;
}

export const DEFAULT_MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealId = string;

export interface DiaryEntry {
  id: string;
  date: string;
  meal: MealId;
  foodId?: string;
  recipeId?: string;
  name: string;
  brand?: string;
  source: FoodSource | 'recipe' | 'quick';
  amount: number;
  unit: 'g' | 'ml' | 'serving';
  servingLabel?: string;
  /** Zubereitung, in der gewogen wurde (z. B. „gekocht“) – per100 ist darauf umgerechnet */
  prep?: string;
  grams: number; // effektive Menge in g bzw. ml
  per100: Nutrients; // Snapshot der Bezugswerte zum Buchungszeitpunkt
  nutrients: Nutrients; // berechnete Werte des Eintrags
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  foodId: string;
  name: string;
  /** Gesamtmenge in g (bei Stück = Anzahl × Stückgewicht) */
  grams: number;
  per100: Nutrients;
  /** Portionsgrößen des Lebensmittels (für Stück-Auswahl) */
  servings?: Serving[];
  /** gewählte Einheit: Index in `servings`, fehlt = Gramm */
  servingIdx?: number;
  /** Anzahl bei Stück-Einheit */
  count?: number;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  servings: number;
  instructions: string;
  ingredients: RecipeIngredient[];
  /** Gewicht des fertigen Gerichts (optional, z. B. nach dem Kochen gewogen) – für Buchen in Gramm */
  cookedGrams?: number;
  imageDataUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type BodyFatMethod = 'manual' | 'navy' | 'device';

export interface Measurement {
  id: string;
  date: string;
  weightKg?: number;
  heightCm?: number;
  bodyFatPct?: number;
  bodyFatMethod?: BodyFatMethod;
  muscleMassKg?: number;
  abdomenCm?: number;
  waistCm?: number;
  hipCm?: number;
  neckCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  custom?: Record<string, number>;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExerciseKind = 'strength' | 'bodyweight' | 'cardio' | 'mobility';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
  kind: ExerciseKind;
  description: string;
  alternatives: string[];
  isCustom: 0 | 1;
  /** Studios, in denen das Gerät steht (z. B. 'vitova-nordenstadt'); Marke/Gerätelinie steht in `equipment`. */
  gyms?: string[];
}

export type SplitType = 'fullbody' | 'upper_lower' | 'ppl' | 'custom' | 'strength' | 'endurance' | 'mobility' | 'bodyweight';

/** Einheit im Plan (z. B. Zirkel): mehrere Übungen nacheinander, als Ganzes mehrfach durchlaufen. */
export interface PlanGroup {
  id: string;
  name: string;
  /** Durchgänge der ganzen Einheit */
  rounds: number;
  /** Pause nach jedem Durchgang */
  restSec: number;
}

export interface PlanExercise {
  id: string;
  exerciseId: string;
  /** Sätze; in einer Einheit = Anzahl Durchgänge */
  sets: number;
  /** optional: unteres Ende eines Wiederholungsbereichs */
  repMin?: number;
  /** Wiederholungsziel (oberes Ende) */
  repMax?: number;
  /** gehört zur Einheit mit dieser ID (Übungen einer Einheit stehen im Plan direkt hintereinander) */
  groupId?: string;
  targetWeightKg?: number;
  restSec: number;
  rpe?: number;
  rir?: number;
  notes?: string;
}

export interface PlanDay {
  id: string;
  name: string;
  weekdays: number[]; // 1=Mo … 7=So
  exercises: PlanExercise[];
  groups?: PlanGroup[];
}

export interface Plan {
  id: string;
  name: string;
  goal: string;
  split: SplitType;
  status: 'draft' | 'active' | 'archived';
  days: PlanDay[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutSet {
  id: string;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
  rpe?: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  restSec: number;
  repMin?: number;
  repMax?: number;
  sets: WorkoutSet[];
  notes?: string;
  /** Einheit aus dem Plan (Zirkel): Satz i = Durchgang i */
  group?: PlanGroup;
}

export interface Workout {
  id: string;
  date: string;
  planId?: string;
  planDayId?: string;
  name: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  exercises: WorkoutExercise[];
  notes: string;
  bodyWeightKg: number | null;
  estimatedKcal: number;
  kcalOverride?: number;
}

export interface ActiveWorkout {
  id: 'current';
  workoutId: string;
  planId?: string;
  planDayId?: string;
  name: string;
  startedAt: string;
  exercises: WorkoutExercise[];
  notes: string;
  rest?: { endsAt: number | null; remainingMs: number; totalMs: number; running: boolean };
}

export type CardioActivity = 'running' | 'walking' | 'cycling' | 'swimming' | 'rowing' | 'elliptical' | 'custom';

export interface CardioSession {
  id: string;
  date: string;
  startedAt: string;
  activity: CardioActivity;
  customName?: string;
  durationMin: number;
  distanceKm?: number;
  avgHr?: number;
  rpe?: number;
  estimatedKcal: number;
  kcalOverride?: number;
  note?: string;
  createdAt: string;
}

export interface WaterLog {
  id: string;
  date: string;
  ml: number;
  createdAt: string;
}

export interface RecoveryLog {
  id: string; // = date
  date: string;
  sleepHours?: number;
  sleepQuality?: number; // 1–5
  /** Schritte des Tages (manuell eingetragen) */
  steps?: number;
  soreness?: number; // 1–5
  energy?: number; // 1–5
}

export interface SavedMeal {
  id: string;
  name: string;
  items: Omit<DiaryEntry, 'id' | 'date' | 'meal' | 'createdAt' | 'updatedAt'>[];
  createdAt: string;
}

export interface MealPlanItem {
  id: string;
  date: string;
  meal: MealId;
  recipeId?: string;
  foodId?: string;
  name: string;
  grams?: number;
  servings?: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  grams?: number;
  checked: boolean;
  createdAt: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface ApiCacheEntry {
  key: string;
  provider: string;
  data: unknown;
  fetchedAt: number;
  expiresAt: number;
}
