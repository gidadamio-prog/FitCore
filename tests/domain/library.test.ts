import { describe, expect, it } from 'vitest';
import { EQUIPMENT, EXERCISE_LIBRARY, MUSCLE_GROUPS, VITOVA_NORDENSTADT } from '@/data/exerciseLibrary';
import { PLAN_TEMPLATES, planFromTemplate } from '@/data/planTemplates';
import { searchExercises, validatePlan } from '@/data/trainingRepo';

const ids = new Set(EXERCISE_LIBRARY.map((e) => e.id));

describe('Übungsbibliothek & Studio-Geräte', () => {
  it('IDs eindeutig, Muskelgruppen/Equipment bekannt, Alternativen existieren', () => {
    expect(ids.size).toBe(EXERCISE_LIBRARY.length);
    for (const e of EXERCISE_LIBRARY) {
      expect(MUSCLE_GROUPS, e.id).toContain(e.primaryMuscle);
      e.secondaryMuscles.forEach((m) => expect(MUSCLE_GROUPS, e.id).toContain(m));
      expect(EQUIPMENT, e.id).toContain(e.equipment);
      e.alternatives.forEach((a) => expect(ids.has(a), `${e.id} → ${a}`).toBe(true));
    }
  });
  it('Vitova Nordenstadt: Technogym Selection, milon, Kinesis, five, Dr. Wolff, DAVID, Sensopro, Arke vorhanden', () => {
    const studio = EXERCISE_LIBRARY.filter((e) => e.gyms?.includes(VITOVA_NORDENSTADT));
    const brands = new Set(studio.map((e) => e.equipment));
    for (const b of ['Technogym Selection', 'milon', 'Technogym Kinesis', 'five', 'Dr. Wolff', 'DAVID', 'Sensopro', 'Arke', 'Technogym Cardio']) expect(brands).toContain(b);
    expect(studio.length).toBeGreaterThanOrEqual(50);
  });
  it('Studio- und Gerätefilter', () => {
    const custom = { ...EXERCISE_LIBRARY[0]!, id: 'custom-x', name: 'Meine Übung', isCustom: 1 as const, gyms: undefined };
    const all = [...EXERCISE_LIBRARY, custom];
    const r = searchExercises(all, '', undefined, { gym: VITOVA_NORDENSTADT });
    expect(r.every((e) => e.gyms?.includes(VITOVA_NORDENSTADT) || e.isCustom === 1)).toBe(true);
    expect(r.some((e) => e.id === 'custom-x')).toBe(true); // eigene Übungen bleiben sichtbar
    const m = searchExercises(all, 'brust', undefined, { equipment: 'milon' });
    expect(m.map((e) => e.id)).toContain('milon-chest-press');
    expect(m.every((e) => e.equipment === 'milon')).toBe(true);
  });
  it('alle Vorlagen verweisen auf existierende Übungen und ergeben gültige Pläne', () => {
    for (const t of PLAN_TEMPLATES) {
      const p = planFromTemplate(t);
      expect(() => validatePlan(p)).not.toThrow();
      p.days.flatMap((d) => d.exercises).forEach((e) => expect(ids.has(e.exerciseId), `${t.id} → ${e.exerciseId}`).toBe(true));
    }
  });
});
