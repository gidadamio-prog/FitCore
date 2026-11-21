// Adaptiver Coach: regelbasierte, nachvollziehbare Hinweise. Keine automatische Anwendung.
import type { CardioSession, GoalVersion, Measurement, Plan, Workout } from './types';
import { dailySeries, emaTrend, linearRegression, type Point } from './body';
import { dailyNutrition, proteinGoalRate, average } from './stats';
import type { DiaryEntry } from './types';
import { addDays, isoWeekday } from './dates';
import { exerciseHistory } from './training';
import { MIN_KCAL } from './energy';

export interface CoachInsight {
  id: string;
  title: string;
  message: string;
  basis: string[]; // Datengrundlage
  reasoning: string; // Begründung
  kind: 'info' | 'positive' | 'attention' | 'limitation';
  proposal?: { type: 'calorie_adjust'; deltaKcal: number; newTarget: number };
}

export const MIN_WEIGHT_SPAN_DAYS = 14;
export const MIN_WEIGHT_POINTS = 7;

export interface CoachInput {
  asOf: string;
  measurements: Measurement[];
  entries: DiaryEntry[];
  goals: GoalVersion[];
  workouts: Workout[];
  cardio: CardioSession[];
  activePlan?: Plan;
  sex: 'male' | 'female';
  deficitAllowed: boolean;
}

export function weightDataSufficiency(points: Point[], asOf: string) {
  const win = points.filter((p) => p.date > addDays(asOf, -28) && p.date <= asOf);
  const reg = linearRegression(win);
  const span = reg?.spanDays ?? 0;
  return { sufficient: win.length >= MIN_WEIGHT_POINTS && span >= MIN_WEIGHT_SPAN_DAYS - 1, points: win.length, spanDays: span, reg, window: win };
}

export function coachInsights(i: CoachInput): CoachInsight[] {
  const out: CoachInsight[] = [];
  const goal = i.goals.length ? [...i.goals].sort((a, b) => (a.effectiveFrom + (a.id ?? 0)).localeCompare(b.effectiveFrom + (b.id ?? 0))).filter((g) => g.effectiveFrom <= i.asOf).pop() : undefined;
  const points = dailySeries(i.measurements);
  const suff = weightDataSufficiency(points, i.asOf);

  // 1) Gewichtstrend vs. Ziel
  if (!suff.sufficient) {
    out.push({
      id: 'weight-insufficient',
      title: 'Zu wenig Gewichtsdaten für eine Trendauswertung',
      message: `Für eine belastbare Aussage brauche ich mindestens ${MIN_WEIGHT_POINTS} Messungen über ${MIN_WEIGHT_SPAN_DAYS} Tage. Aktuell: ${suff.points} Messungen über ${suff.spanDays} Tage (letzte 28 Tage).`,
      basis: [`${suff.points} Gewichtsmessungen`, `Zeitspanne ${suff.spanDays} Tage`],
      reasoning: 'Tägliche Gewichtsschwankungen (Wasser, Verdauung) von 1–2 kg überdecken kurzfristige Trends.',
      kind: 'limitation',
    });
  } else if (goal && suff.reg) {
    const observed = Math.round(suff.reg.slopePerDay * 7 * 100) / 100;
    const target = goal.weeklyRateKg;
    const trend = emaTrend(suff.window);
    const basis = [`${suff.points} Messungen über ${suff.spanDays} Tage`, `Beobachtet: ${observed > 0 ? '+' : ''}${observed} kg/Woche`, `Ziel: ${target > 0 ? '+' : ''}${target} kg/Woche`];
    const curWeight = trend[trend.length - 1]!.value;
    if (target < 0) {
      if (observed > target * 0.5) {
        const delta = -150;
        const floor = MIN_KCAL[i.sex];
        const newTarget = Math.max(floor, goal.calorieTarget + delta);
        out.push({
          id: 'weight-slower',
          title: 'Gewicht sinkt langsamer als geplant',
          message: 'Dein Gewicht entwickelt sich langsamer als dein festgelegtes Ziel. Prüfe, ob die bisherigen Daten (inkl. vollständiger Protokollierung) für eine Anpassung ausreichen.',
          basis,
          reasoning: 'Weniger als die Hälfte der geplanten Abnahme in den letzten Wochen. Mögliche Ursachen sind unvollständige Einträge, Wassereinlagerungen oder ein überschätzter Bedarf – ein Zusammenhang ist nicht bewiesen.',
          kind: 'attention',
          proposal: i.deficitAllowed && newTarget < goal.calorieTarget ? { type: 'calorie_adjust', deltaKcal: newTarget - goal.calorieTarget, newTarget } : undefined,
        });
      } else if (observed < -curWeight * 0.01) {
        const newTarget = goal.calorieTarget + 150;
        out.push({
          id: 'weight-too-fast',
          title: 'Gewicht sinkt schneller als 1 % pro Woche',
          message: 'Ein sehr schneller Gewichtsverlust kann Muskelmasse und Leistung kosten. Eine moderate Anhebung des Kalorienziels wäre möglich.',
          basis,
          reasoning: 'Empfohlene Abnahme liegt meist bei 0,5–1 % des Körpergewichts pro Woche.',
          kind: 'attention',
          proposal: { type: 'calorie_adjust', deltaKcal: 150, newTarget },
        });
      } else {
        out.push({ id: 'weight-on-track', title: 'Gewichtstrend im Plan', message: 'Dein Gewicht entwickelt sich im Rahmen deines Ziels.', basis, reasoning: 'Beobachtete Rate liegt zwischen 50 % der Zielrate und 1 %/Woche.', kind: 'positive' });
      }
    } else if (target > 0) {
      if (observed < target * 0.5) {
        const newTarget = goal.calorieTarget + 150;
        out.push({ id: 'gain-slower', title: 'Zunahme langsamer als geplant', message: 'Dein Gewicht steigt langsamer als geplant. Eine moderate Erhöhung des Kalorienziels wäre möglich.', basis, reasoning: 'Weniger als die Hälfte der geplanten Zunahme.', kind: 'attention', proposal: { type: 'calorie_adjust', deltaKcal: 150, newTarget } });
      } else if (observed > target * 2) {
        const newTarget = goal.calorieTarget - 150;
        out.push({ id: 'gain-faster', title: 'Zunahme schneller als geplant', message: 'Dein Gewicht steigt deutlich schneller als geplant – ein Teil davon ist vermutlich Fett.', basis, reasoning: 'Mehr als das Doppelte der geplanten Zunahme.', kind: 'attention', proposal: { type: 'calorie_adjust', deltaKcal: -150, newTarget } });
      } else out.push({ id: 'gain-on-track', title: 'Zunahme im Plan', message: 'Dein Gewicht entwickelt sich im Rahmen deines Ziels.', basis, reasoning: 'Rate im geplanten Bereich.', kind: 'positive' });
    } else {
      if (Math.abs(observed) > 0.25) {
        out.push({ id: 'maintain-drift', title: 'Gewicht weicht vom Halteziel ab', message: `Dein Gewicht verändert sich um ${observed} kg/Woche, obwohl du es halten möchtest.`, basis, reasoning: 'Abweichung > 0,25 kg/Woche.', kind: 'attention', proposal: { type: 'calorie_adjust', deltaKcal: observed < 0 ? 100 : -100, newTarget: goal.calorieTarget + (observed < 0 ? 100 : -100) } });
      } else out.push({ id: 'maintain-ok', title: 'Gewicht stabil', message: 'Dein Gewicht ist stabil – passend zu deinem Halteziel.', basis, reasoning: 'Abweichung ≤ 0,25 kg/Woche.', kind: 'positive' });
    }
  }

  // 2) Protein letzte 7 Tage
  const from7 = addDays(i.asOf, -6);
  const days7 = dailyNutrition(i.entries, i.goals, from7, i.asOf);
  const pr = proteinGoalRate(days7);
  if (pr.evaluableDays > 0) {
    out.push({
      id: 'protein-7d',
      title: 'Proteinziel',
      message: `Du hast dein Proteinziel an ${pr.hitDays} von ${pr.evaluableDays} protokollierten Tagen erreicht${pr.missingDates.length ? ` (${pr.missingDates.length} Tage ohne Einträge)` : ''}.`,
      basis: [`${pr.evaluableDays} auswertbare Tage (letzte 7)`, `Ø Protein: ${average(days7.map((d) => d.protein)) ?? '–'} g`],
      reasoning: 'Erreicht = mindestens 90 % des Tagesziels.',
      kind: pr.rate != null && pr.rate >= 0.7 ? 'positive' : 'info',
    });
  } else {
    out.push({ id: 'nutrition-missing', title: 'Keine Ernährungsdaten', message: 'In den letzten 7 Tagen wurden keine Mahlzeiten protokolliert.', basis: ['0 Tage mit Einträgen'], reasoning: 'Ohne Daten keine Auswertung.', kind: 'limitation' });
  }

  // 3) Trainingsfrequenz vs. Plan
  if (i.activePlan) {
    const planned = new Set(i.activePlan.days.flatMap((d) => d.weekdays)).size;
    const from = addDays(i.asOf, -27);
    const sessions = i.workouts.filter((w) => w.date >= from && w.date <= i.asOf).length;
    const perWeek = Math.round((sessions / 4) * 10) / 10;
    if (planned > 0) {
      out.push({
        id: 'frequency',
        title: 'Trainingshäufigkeit',
        message: `Du trainierst im Schnitt ${perWeek}× pro Woche (Plan: ${planned}×).`,
        basis: [`${sessions} Krafteinheiten in 28 Tagen`, `Plan „${i.activePlan.name}“`],
        reasoning: 'Durchschnitt über 4 Wochen.',
        kind: perWeek >= planned * 0.8 ? 'positive' : 'info',
      });
    }
  }

  // 4) Kraftentwicklung vs. Gewicht (Korrelation, keine Kausalität)
  const recent = i.workouts.filter((w) => w.date > addDays(i.asOf, -42));
  const ids = [...new Set(recent.flatMap((w) => w.exercises.map((e) => e.exerciseId)))];
  const gains: { name: string; pct: number }[] = [];
  for (const id of ids) {
    const h = exerciseHistory(recent, id).filter((s) => s.bestE1RM != null);
    if (h.length >= 3) {
      const first = h[0]!.bestE1RM!;
      const last = h[h.length - 1]!.bestE1RM!;
      const name = recent.flatMap((w) => w.exercises).find((e) => e.exerciseId === id)?.name ?? id;
      gains.push({ name, pct: Math.round(((last - first) / first) * 100) });
    }
  }
  if (gains.length) {
    const avgGain = Math.round(gains.reduce((a, g) => a + g.pct, 0) / gains.length);
    const wReg = suff.reg;
    const stableWeight = wReg ? Math.abs(wReg.slopePerDay * 7) < 0.15 : null;
    out.push({
      id: 'strength',
      title: avgGain > 0 ? 'Kraftwerte steigen' : 'Kraftwerte stagnieren',
      message:
        avgGain > 0 && stableWeight
          ? 'Deine Kraftwerte steigen, während dein Gewicht relativ konstant bleibt.'
          : `Deine geschätzten Maximalkraftwerte haben sich in den letzten 6 Wochen um durchschnittlich ${avgGain > 0 ? '+' : ''}${avgGain} % verändert.`,
      basis: gains.slice(0, 4).map((g) => `${g.name}: ${g.pct > 0 ? '+' : ''}${g.pct} % (e1RM)`),
      reasoning: 'Vergleich des geschätzten 1RM (Epley) erste vs. letzte Einheit. Gleichzeitige Entwicklungen sind Korrelationen, keine bewiesene Ursache.',
      kind: avgGain > 0 ? 'positive' : 'info',
    });
  }
  return out;
}

// ---------- Trainingstagspezifische Empfehlungen (rein informativ) ----------

export type DayType = 'strength' | 'endurance' | 'recovery' | 'rest';

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  strength: 'Krafttrainingstag',
  endurance: 'Ausdauertag',
  recovery: 'Regenerationstag',
  rest: 'Trainingsfreier Tag',
};

export function classifyDay(date: string, workouts: Workout[], cardio: CardioSession[], plan?: Plan, recoveryFlag = false): DayType {
  if (workouts.some((w) => w.date === date)) return 'strength';
  if (cardio.some((c) => c.date === date && c.durationMin >= 20)) return 'endurance';
  if (plan && plan.days.some((d) => d.weekdays.includes(isoWeekday(date)))) return 'strength';
  if (recoveryFlag || cardio.some((c) => c.date === date)) return 'recovery';
  return 'rest';
}

export interface DayRecommendation {
  topic: string;
  text: string;
  basis: string;
}

export function dayRecommendations(type: DayType, weightKg: number | null, goal?: GoalVersion, trainingMinutes = 0): DayRecommendation[] {
  const w = weightKg ?? null;
  const recs: DayRecommendation[] = [];
  const fluidBase = w ? Math.round(w * 35) : null;
  const fluidExtra = Math.round((trainingMinutes / 60) * 500);
  recs.push({
    topic: 'Flüssigkeit',
    text: fluidBase ? `Ca. ${((fluidBase + fluidExtra) / 1000).toFixed(1).replace('.', ',')} l über den Tag verteilt${fluidExtra ? ` (inkl. ~${fluidExtra} ml für Training)` : ''}.` : 'Gewicht erfassen, um eine Trinkmenge abzuleiten.',
    basis: '≈ 35 ml/kg Körpergewicht + ca. 0,5 l je Trainingsstunde (Richtwert)',
  });
  if (goal) {
    const perMeal = w ? `${Math.round(w * 0.3)}–${Math.round(w * 0.4)} g` : '20–40 g';
    recs.push({ topic: 'Protein', text: `Tagesziel ${goal.proteinG} g – verteilt auf 3–5 Mahlzeiten à ${perMeal}.`, basis: '0,3–0,4 g/kg pro Mahlzeit (Richtwert)' });
  }
  if (type === 'strength') {
    recs.push({ topic: 'Vor dem Training', text: '1–3 h vorher eine Mahlzeit mit Kohlenhydraten und etwas Protein, fettarm für gute Verträglichkeit.', basis: 'Allgemeine sporternährungswissenschaftliche Empfehlung' });
    recs.push({ topic: 'Nach dem Training', text: 'Innerhalb von ~2 h eine proteinreiche Mahlzeit (20–40 g Protein) mit Kohlenhydraten.', basis: 'Allgemeine Empfehlung' });
  } else if (type === 'endurance') {
    recs.push({ topic: 'Kohlenhydrate', text: w ? `Für längere/intensive Einheiten eher mehr Kohlenhydrate einplanen (ca. ${Math.round(w * 5)}–${Math.round(w * 7)} g/Tag bei 1 h moderatem Training).` : 'An Ausdauertagen eher mehr Kohlenhydrate einplanen.', basis: '5–7 g/kg bei moderatem Ausdauertraining ~1 h/Tag (Richtwert)' });
    recs.push({ topic: 'Während', text: 'Bei Einheiten > 60–90 min 30–60 g Kohlenhydrate pro Stunde erwägen.', basis: 'Allgemeine Empfehlung' });
  } else if (type === 'recovery') {
    recs.push({ topic: 'Energie', text: 'Normale Energiezufuhr nach Ziel; Fokus auf Protein, Gemüse und Schlaf.', basis: 'Regeneration' });
  } else {
    recs.push({ topic: 'Energie', text: 'Keine zusätzliche Trainingsenergie – Kalorienziel ohne Zuschlag.', basis: 'Kein Training erfasst' });
  }
  return recs;
}
