// Lokale Datenbank (IndexedDB via Dexie) mit versionierten Migrationen.
import Dexie, { type Table } from 'dexie';
import type {
  ActiveWorkout,
  ApiCacheEntry,
  CardioSession,
  DiaryEntry,
  Exercise,
  FoodItem,
  GoalVersion,
  MealPlanItem,
  Measurement,
  Plan,
  Profile,
  Recipe,
  RecoveryLog,
  SavedMeal,
  Setting,
  ShoppingItem,
  WaterLog,
  Workout,
} from '@/domain/types';

export const DB_NAME = 'fitcore';
export const SCHEMA_VERSION = 2;

/** Schema v1 – erster Release-Stand. Wird für Migrationstests auch separat verwendet. */
export const SCHEMA_V1 = {
  profile: 'id',
  goals: '++id, effectiveFrom',
  foods: 'id, name, barcode, source, favorite, useCount, lastUsedAt',
  diary: 'id, date, meal, foodId, recipeId, [date+meal]',
  recipes: 'id, name, category',
  measurements: 'id, date',
  exercises: 'id, name, primaryMuscle, isCustom',
  plans: 'id, status, updatedAt',
  workouts: 'id, date, planId, startedAt',
  activeWorkout: 'id',
  cardio: 'id, date, startedAt',
  water: 'id, date',
  settings: 'key',
  apiCache: 'key, provider, expiresAt',
};

/** Schema v2 – ergänzt Regeneration, gespeicherte Mahlzeiten, Wochenplan, Einkaufsliste. */
export const SCHEMA_V2 = {
  ...SCHEMA_V1,
  measurements: 'id, date, bodyFatMethod',
  recovery: 'id, date',
  savedMeals: 'id, name',
  mealPlan: 'id, date',
  shopping: 'id, checked',
};

export class FitCoreDB extends Dexie {
  profile!: Table<Profile, string>;
  goals!: Table<GoalVersion, number>;
  foods!: Table<FoodItem, string>;
  diary!: Table<DiaryEntry, string>;
  recipes!: Table<Recipe, string>;
  measurements!: Table<Measurement, string>;
  exercises!: Table<Exercise, string>;
  plans!: Table<Plan, string>;
  workouts!: Table<Workout, string>;
  activeWorkout!: Table<ActiveWorkout, string>;
  cardio!: Table<CardioSession, string>;
  water!: Table<WaterLog, string>;
  settings!: Table<Setting, string>;
  apiCache!: Table<ApiCacheEntry, string>;
  recovery!: Table<RecoveryLog, string>;
  savedMeals!: Table<SavedMeal, string>;
  mealPlan!: Table<MealPlanItem, string>;
  shopping!: Table<ShoppingItem, string>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    this.version(2)
      .stores(SCHEMA_V2)
      .upgrade(async (tx) => {
        // v1 speicherte die Körperfettquelle als `bodyFatSource` ('measured' | 'navy'). v2: `bodyFatMethod`.
        await tx
          .table('measurements')
          .toCollection()
          .modify((m: Record<string, unknown>) => {
            if ('bodyFatSource' in m) {
              const src = m.bodyFatSource;
              m.bodyFatMethod = src === 'navy' ? 'navy' : src === 'device' ? 'device' : 'manual';
              delete m.bodyFatSource;
            }
            if (!m.updatedAt) m.updatedAt = (m.createdAt as string) ?? new Date().toISOString();
          });
        // v1-Tagebucheinträge ohne updatedAt ergänzen
        await tx
          .table('diary')
          .toCollection()
          .modify((e: Record<string, unknown>) => {
            if (!e.updatedAt) e.updatedAt = (e.createdAt as string) ?? new Date().toISOString();
          });
      });
  }
}

export let db = new FitCoreDB();

/** Nur für Tests: eigene, getrennte DB-Instanz (z. B. "frische App-Instanz" beim Restore). */
export function setDatabase(instance: FitCoreDB) {
  db = instance;
}

export const ALL_TABLES = [
  'profile',
  'goals',
  'foods',
  'diary',
  'recipes',
  'measurements',
  'exercises',
  'plans',
  'workouts',
  'activeWorkout',
  'cardio',
  'water',
  'settings',
  'recovery',
  'savedMeals',
  'mealPlan',
  'shopping',
] as const;
export type TableName = (typeof ALL_TABLES)[number];
