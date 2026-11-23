// Planvorlagen – werden als bearbeitbare Kopie (Entwurf) angelegt.
import type { Plan, SplitType } from '@/domain/types';
import { uid } from '@/domain/dates';
import { VITOVA_NORDENSTADT } from './exerciseLibrary';

interface DayTpl {
  name: string;
  weekdays: number[];
  exercises: string[];
  /** alle Übungen des Tages als eine Einheit (Zirkel) */
  circuit?: { name: string; rounds: number; restSec: number };
}
export interface PlanTemplate {
  id: string;
  name: string;
  goal: string;
  split: SplitType;
  description: string;
  gym?: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  days: DayTpl[];
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'vitova-milon',
    name: 'milon-Zirkel Ganzkörper',
    goal: 'Gesundheit & Kraftausdauer',
    split: 'fullbody',
    description: 'Klassischer Durchgang durch den milon-Gesundheitszirkel, 2 Runden. Ideal für 2–3 Einheiten pro Woche.',
    gym: VITOVA_NORDENSTADT,
    sets: 2,
    repMin: 12,
    repMax: 15,
    restSec: 30,
    days: [{ name: 'Zirkel', weekdays: [1, 3, 5], exercises: ['milon-chest-press', 'milon-row', 'milon-leg-press', 'milon-lat-pulldown', 'milon-shoulder-press', 'milon-abdominal', 'milon-back-extension', 'milon-leg-curl'] }],
  },
  {
    id: 'vitova-egym',
    name: 'EGYM-Zirkel Ganzkörper',
    goal: 'Kraft & Gesundheit',
    split: 'fullbody',
    description: 'Klassischer EGYM-Kraftzirkel mit 9 Stationen als Einheit, 2 Durchgänge mit 90 s Pause dazwischen. Die Geräte stellen sich per EGYM ID selbst ein – Gewicht und Wiederholungen vom Display übernehmen. Stationen im Plan an deinen Zirkel anpassen.',
    gym: VITOVA_NORDENSTADT,
    sets: 2,
    repMin: 10,
    repMax: 15,
    restSec: 30,
    days: [{ name: 'Zirkel', weekdays: [1, 3, 5], circuit: { name: 'EGYM-Zirkel', rounds: 2, restSec: 90 }, exercises: ['egym-chest-press', 'egym-seated-row', 'egym-leg-press', 'egym-abdominal', 'egym-back-extension', 'egym-butterfly', 'egym-reverse-butterfly', 'egym-leg-extension', 'egym-leg-curl'] }],
  },
  {
    id: 'vitova-tg-ab',
    name: 'Technogym Ganzkörper A/B',
    goal: 'Muskelaufbau',
    split: 'fullbody',
    description: 'Zwei abwechselnde Ganzkörpertage an der Technogym Selection Line – sicher geführte Maschinen, 3 Sätze.',
    gym: VITOVA_NORDENSTADT,
    sets: 3,
    repMin: 8,
    repMax: 12,
    restSec: 90,
    days: [
      { name: 'Tag A', weekdays: [1, 4], exercises: ['tg-leg-press', 'tg-chest-press', 'tg-lat-machine', 'tg-leg-curl', 'tg-shoulder-press', 'tg-abdominal'] },
      { name: 'Tag B', weekdays: [2, 5], exercises: ['tg-leg-extension', 'tg-low-row', 'tg-pectoral', 'tg-glute', 'tg-rear-delt', 'tg-lower-back'] },
    ],
  },
  {
    id: 'vitova-upper-lower',
    name: 'Oberkörper/Unterkörper (Technogym)',
    goal: 'Kraft & Muskelaufbau',
    split: 'upper_lower',
    description: '4 Tage pro Woche, Ober- und Unterkörper getrennt, komplett an den Selection-Maschinen.',
    gym: VITOVA_NORDENSTADT,
    sets: 3,
    repMin: 6,
    repMax: 10,
    restSec: 120,
    days: [
      { name: 'Oberkörper', weekdays: [1, 4], exercises: ['tg-chest-press', 'tg-low-row', 'tg-shoulder-press', 'tg-lat-machine', 'tg-arm-curl', 'tg-arm-extension'] },
      { name: 'Unterkörper', weekdays: [2, 5], exercises: ['tg-leg-press', 'tg-leg-curl', 'tg-leg-extension', 'tg-abductor', 'tg-adductor', 'tg-abdominal'] },
    ],
  },
  {
    id: 'vitova-back',
    name: 'Rücken & Haltung',
    goal: 'Rückengesundheit',
    split: 'custom',
    description: 'Rumpf-Geräte von Dr. Wolff, Schultergürtel, five-Mobilisation und Sensopro-Koordination.',
    gym: VITOVA_NORDENSTADT,
    sets: 2,
    repMin: 12,
    repMax: 15,
    restSec: 60,
    days: [{ name: 'Rücken', weekdays: [2, 6], exercises: ['wolff-back-extension', 'wolff-rotation', 'wolff-lateral', 'tg-rear-delt', 'five-back', 'five-hip', 'five-chest', 'sensopro'] }],
  },
  {
    id: 'vitova-kinesis',
    name: 'Functional (Kinesis & Arke)',
    goal: 'Athletik & Stabilität',
    split: 'custom',
    description: 'Seilzug-Ganzkörperübungen an den Kinesis Stations plus Core-Training.',
    gym: VITOVA_NORDENSTADT,
    sets: 3,
    repMin: 10,
    repMax: 15,
    restSec: 60,
    days: [{ name: 'Functional', weekdays: [3], exercises: ['kinesis-squat-row', 'kinesis-lunge-press', 'kinesis-rotation', 'kinesis-lat-pull', 'kinesis-shoulder', 'arke-core'] }],
  },
  {
    id: 'ppl-free',
    name: 'Push/Pull/Legs (Freihantel)',
    goal: 'Muskelaufbau',
    split: 'ppl',
    description: 'Klassischer 3er-Split mit Lang- und Kurzhanteln.',
    sets: 3,
    repMin: 6,
    repMax: 10,
    restSec: 120,
    days: [
      { name: 'Push', weekdays: [1, 4], exercises: ['bench-press', 'incline-db-press', 'overhead-press', 'lateral-raise', 'triceps-pushdown'] },
      { name: 'Pull', weekdays: [2, 5], exercises: ['deadlift', 'pull-up', 'barbell-row', 'face-pull', 'barbell-curl'] },
      { name: 'Legs', weekdays: [3, 6], exercises: ['squat', 'romanian-deadlift', 'leg-press', 'leg-curl', 'calf-raise'] },
    ],
  },
  {
    id: 'bodyweight-home',
    name: 'Ganzkörper ohne Geräte',
    goal: 'Allgemeine Fitness',
    split: 'bodyweight',
    description: 'Für Tage ohne Studio – nur Körpergewicht.',
    sets: 3,
    repMin: 10,
    repMax: 20,
    restSec: 60,
    days: [{ name: 'Zuhause', weekdays: [], exercises: ['push-up', 'bodyweight-squat', 'inverted-row', 'glute-bridge', 'plank', 'mountain-climber'] }],
  },
];

export function planFromTemplate(t: PlanTemplate): Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: t.name,
    goal: t.goal,
    split: t.split,
    status: 'draft',
    notes: t.description,
    days: t.days.map((d) => {
      const g = d.circuit ? { id: uid(), ...d.circuit } : undefined;
      return {
        id: uid(),
        name: d.name,
        weekdays: [...d.weekdays],
        exercises: d.exercises.map((exerciseId) => ({ id: uid(), exerciseId, sets: g ? g.rounds : t.sets, repMin: t.repMin, repMax: t.repMax, restSec: g ? 0 : t.restSec, ...(g ? { groupId: g.id } : {}) })),
        ...(g ? { groups: [g] } : {}),
      };
    }),
  };
}
