// Geheime Erfolge: erscheinen bis zum Freischalten als „???“. Belohnung: Titel und Denare.
import type { Workout } from './types';
import type { DayFacts, PrEvent } from './gamification';
import { addDays, startOfWeek } from './dates';
import { isCompletedSet } from './training';

export interface SecretAchievement {
  id: string;
  name: string;
  hint: string;
  description: string;
  category: 'kraft' | 'ausdauer' | 'ernaehrung' | 'disziplin' | 'ruhm';
  reward: { title: string; denare: number };
  achieved: boolean;
  date: string | null;
  progress: { value: number; target: number } | null;
}

export const LEG_MUSCLES = new Set(['Quadrizeps', 'Rückseite Oberschenkel', 'Gesäß', 'Adduktoren', 'Waden']);

/** Lokale Stunde eines ISO-Zeitstempels */
const localHour = (iso: string) => new Date(iso).getHours();

export function secretAchievements(i: { workouts: Workout[]; facts: Map<string, DayFacts>; prs: PrEvent[]; comebacks: string[]; today: string }): SecretAchievement[] {
  const workouts = i.workouts.filter((w) => w.date <= i.today).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const facts = [...i.facts.values()].filter((f) => f.date <= i.today).sort((a, b) => a.date.localeCompare(b.date));

  // Frühaufsteher: Training vor 7 Uhr begonnen
  const early = workouts.find((w) => localHour(w.startedAt) < 7);

  // Doppelschicht: zwei Einheiten an einem Tag
  const double = facts.find((f) => f.workouts + f.cardioSessions >= 2);

  // Beinfreund: 8 Wochen in Folge mit Beintraining
  const legWeeks = [...new Set(workouts.filter((w) => w.exercises.some((e) => LEG_MUSCLES.has(e.primaryMuscle) && e.sets.some(isCompletedSet))).map((w) => startOfWeek(w.date)))].sort();
  let run = 0;
  let bestRun = 0;
  let legDate: string | null = null;
  for (let k = 0; k < legWeeks.length; k++) {
    run = k > 0 && addDays(legWeeks[k - 1]!, 7) === legWeeks[k] ? run + 1 : 1;
    bestRun = Math.max(bestRun, run);
    if (run >= 8 && !legDate) legDate = legWeeks[k]!;
  }
  const legLastDate = legDate ? workouts.filter((w) => startOfWeek(w.date) === legDate).map((w) => w.date).sort()[0] ?? legDate : null;

  // Wiedersehen: Bestleistung innerhalb von 7 Tagen nach einem Comeback
  const reunion = i.prs.filter((p) => p.date <= i.today).find((p) => i.comebacks.some((c) => p.date >= c && p.date <= addDays(c, 6)));

  // Stoiker: 30 Tage in Folge Kalorienziel ± 10 % getroffen
  let streak = 0;
  let bestStreak = 0;
  let stoicDate: string | null = null;
  let prev: string | null = null;
  for (const f of facts) {
    if (f.caloriesHit) {
      streak = prev && addDays(prev, 1) === f.date ? streak + 1 : 1;
      prev = f.date;
      bestStreak = Math.max(bestStreak, streak);
      if (streak >= 30 && !stoicDate) stoicDate = f.date;
    } else {
      streak = 0;
      prev = null;
    }
  }

  return [
    { id: 'fruehaufsteher', name: 'Frühaufsteher', hint: 'Wer früh aufsteht …', description: 'Ein Training vor 7 Uhr begonnen.', category: 'disziplin', reward: { title: 'der Frühaufsteher', denare: 50 }, achieved: !!early, date: early?.date ?? null, progress: null },
    { id: 'doppelschicht', name: 'Doppelschicht', hint: 'Einmal reicht nicht.', description: 'Zwei Einheiten an einem Tag.', category: 'ausdauer', reward: { title: 'der Unermüdliche', denare: 50 }, achieved: !!double, date: double?.date ?? null, progress: null },
    { id: 'beinfreund', name: 'Säulen des Reiches', hint: 'Ein Tempel steht auf seinen Säulen.', description: '8 Wochen in Folge Beine trainiert.', category: 'kraft', reward: { title: 'Säule des Reiches', denare: 100 }, achieved: !!legDate, date: legLastDate, progress: { value: Math.min(8, bestRun), target: 8 } },
    { id: 'wiedersehen', name: 'Wiedersehen', hint: 'Zurück und stärker als zuvor.', description: 'Eine Bestleistung in der Woche nach einem Comeback.', category: 'ruhm', reward: { title: 'der Wiedergekehrte', denare: 75 }, achieved: !!reunion, date: reunion?.date ?? null, progress: null },
    { id: 'stoiker', name: 'Stoische Ruhe', hint: 'Maß halten, Tag für Tag.', description: '30 Tage in Folge das Kalorienziel auf ± 10 % getroffen.', category: 'ernaehrung', reward: { title: 'der Stoiker', denare: 150 }, achieved: !!stoicDate, date: stoicDate, progress: { value: Math.min(30, bestStreak), target: 30 } },
  ];
}
