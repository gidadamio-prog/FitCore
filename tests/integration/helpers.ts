import { FitCoreDB, setDatabase } from '@/data/db';
import { completeOnboarding, ensureSeed } from '@/data/profileRepo';
import type { ProfileForm } from '@/domain/schemas';

let n = 0;
export async function freshDb(): Promise<FitCoreDB> {
  const d = new FitCoreDB('fitcore-test-' + ++n + '-' + Math.random().toString(36).slice(2));
  setDatabase(d);
  await d.open();
  await ensureSeed();
  return d;
}

export const PROFILE: ProfileForm = {
  name: 'Test', birthDate: `${new Date().getFullYear() - 36}-01-01`, sex: 'male', heightCm: 180, weightKg: 80, activityLevel: 'moderate', experience: 'intermediate',
  trainingDaysPerWeek: 3, dietPreference: 'omnivor', equipment: ['Langhantel'], specialSituation: 'none',
};

export async function onboard() {
  return completeOnboarding(PROFILE, { primaryGoal: 'lose_weight', secondaryGoals: ['strength'], macroStrategy: 'balanced', formula: 'mifflin', weeklyRateKg: -0.5 });
}
