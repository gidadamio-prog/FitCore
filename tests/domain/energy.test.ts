import { describe, expect, it } from 'vitest';
import { ageFromBirthDate, bmrKatch, bmrMifflin, calorieGoal, computeTargets, macroConsistency, macroTargets, tdee, ValidationError } from '@/domain/energy';

describe('Grundumsatz Mifflin-St Jeor', () => {
  it('AK-012: 80 kg, 180 cm, 30 J., +5 → 1780 kcal', () => {
    expect(bmrMifflin(80, 180, 30, 'male')).toBe(1780);
  });
  it('Frauen-Variante −161 (unabhängiger Referenzwert 60/165/25 → 1345,25)', () => {
    // 10·60 + 6,25·165 − 5·25 − 161 = 600 + 1031,25 − 125 − 161 = 1345,25
    expect(bmrMifflin(60, 165, 25, 'female')).toBeCloseTo(1345.25, 2);
  });
  it('Grenzfälle: Mindestalter 18 und Maximalwerte', () => {
    expect(bmrMifflin(30, 120, 18, 'female')).toBeCloseTo(300 + 750 - 90 - 161, 5);
    expect(() => bmrMifflin(80, 180, 17, 'male')).toThrow(ValidationError);
  });
  it('ungültige Eingaben werden abgelehnt', () => {
    expect(() => bmrMifflin(NaN, 180, 30, 'male')).toThrow(ValidationError);
    expect(() => bmrMifflin(80, 300, 30, 'male')).toThrow(/Größe/);
    expect(() => bmrMifflin(-5, 180, 30, 'male')).toThrow(/Gewicht/);
  });
  it('Katch-McArdle: 80 kg, 20 % KF → 370 + 21,6·64 = 1752,4', () => {
    expect(bmrKatch(80, 20)).toBeCloseTo(1752.4, 5);
  });
  it('Altersberechnung vor/nach Geburtstag', () => {
    expect(ageFromBirthDate('1990-06-15', new Date('2020-06-14T12:00:00'))).toBe(29);
    expect(ageFromBirthDate('1990-06-15', new Date('2020-06-15T12:00:00'))).toBe(30);
    expect(() => ageFromBirthDate('kein-datum')).toThrow(ValidationError);
  });
});

describe('Gesamtenergiebedarf (AK-013)', () => {
  it('BMR × Aktivitätsfaktor', () => {
    expect(tdee(1780, 'sedentary')).toBeCloseTo(2136, 5);
    expect(tdee(1780, 'moderate')).toBeCloseTo(2759, 5);
    expect(tdee(1780, 'very_active')).toBeCloseTo(3382, 5);
  });
  it('computeTargets liefert Formel, BMR, TDEE, Anpassung und Ziel nachvollziehbar', () => {
    const r = computeTargets({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate', formula: 'mifflin', goal: 'lose_weight', weeklyRateKg: -0.5, strategy: 'balanced', specialSituation: 'none' });
    expect(r.formula).toBe('mifflin');
    expect(r.bmr).toBe(1780);
    expect(r.tdee).toBe(2759);
    expect(r.adjustmentKcal).toBe(-550);
    expect(r.calorieTarget).toBe(2209);
  });
  it('Katch fällt ohne Körperfett auf Mifflin zurück', () => {
    const r = computeTargets({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'sedentary', formula: 'katch', goal: 'maintain', weeklyRateKg: 0, strategy: 'balanced', specialSituation: 'none' });
    expect(r.formula).toBe('mifflin');
  });
});

describe('Kalorienziel – Sicherheitsgrenzen', () => {
  const base = { bmr: 1780, tdee: 2759, sex: 'male' as const, specialSituation: 'none' as const };
  it('Defizit wird auf 25 % / 1000 kcal begrenzt', () => {
    const r = calorieGoal({ ...base, goal: 'lose_weight', weeklyRateKg: -1.5 });
    expect(r.adjustmentKcal).toBe(-690); // 25 % von 2759
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('Untergrenze wird nie unterschritten', () => {
    const r = calorieGoal({ bmr: 1200, tdee: 1500, sex: 'female', specialSituation: 'none', goal: 'lose_weight', weeklyRateKg: -1 });
    expect(r.calorieTarget).toBeGreaterThanOrEqual(1200);
  });
  it('Schwangerschaft/Stillzeit: kein automatisches Defizit', () => {
    const r = calorieGoal({ ...base, specialSituation: 'pregnant', goal: 'lose_weight', weeklyRateKg: -0.5 });
    expect(r.adjustmentKcal).toBe(0);
    expect(r.deficitAllowed).toBe(false);
    expect(r.warnings[0]).toMatch(/Schwangerschaft/);
  });
  it('Überschuss maximal 500 kcal', () => {
    expect(calorieGoal({ ...base, goal: 'build_muscle', weeklyRateKg: 1 }).adjustmentKcal).toBe(500);
  });
  it('ungültige Raten werden abgelehnt', () => {
    expect(() => calorieGoal({ ...base, goal: 'lose_weight', weeklyRateKg: -3 })).toThrow(ValidationError);
  });
});

describe('Makronährstoffe', () => {
  it('Protein nach Ziel, Fett ≥ 0,6 g/kg, Rest Kohlenhydrate', () => {
    const m = macroTargets({ calorieTarget: 2200, weightKg: 80, goal: 'lose_weight', strategy: 'balanced' });
    expect(m.proteinG).toBe(160);
    expect(m.fatG).toBe(73); // 30 % von 2200 / 9 = 73,3
    expect(m.carbsG).toBe(Math.round((2200 - 640 - 657) / 4));
    expect(macroConsistency(2200, m.proteinG, m.carbsG, m.fatG).consistent).toBe(true);
  });
  it('Inkonsistente manuelle Makros werden erkannt', () => {
    const c = macroConsistency(2000, 200, 300, 100);
    expect(c.sum).toBe(2900);
    expect(c.diff).toBe(900);
    expect(c.consistent).toBe(false);
  });
  it('Sehr knappes Ziel: Kohlenhydrate nie negativ', () => {
    const m = macroTargets({ calorieTarget: 900, weightKg: 120, goal: 'lose_weight', strategy: 'low_carb' });
    expect(m.carbsG).toBeGreaterThanOrEqual(0);
    expect(m.warnings.length).toBe(1);
  });
});

describe('Ziele (AK-011)', () => {
  it.each(['lose_weight', 'maintain', 'build_muscle', 'recomp', 'reduce_fat', 'strength', 'endurance', 'general'] as const)('Ziel %s ist berechenbar', (goal) => {
    const r = computeTargets({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate', formula: 'mifflin', goal, weeklyRateKg: 0, strategy: 'balanced', specialSituation: 'none' });
    expect(r.calorieTarget).toBe(2759);
    expect(r.proteinG).toBeGreaterThan(0);
  });
});
