import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Pause, Play, Plus, RotateCcw, Trash2, Repeat, TrendingUp } from 'lucide-react';
import { Badge, Button, Card, Empty, NumberInput, Textarea, cn, fmt } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { useActiveWorkout, useWorkouts } from '@/hooks/data';
import type { ActiveWorkout, Exercise, WorkoutExercise } from '@/domain/types';
import { buildWorkoutExercise, discardActiveWorkout, finishWorkout, saveActiveWorkout } from '@/data/trainingRepo';
import { formatDuration, uid } from '@/domain/dates';
import { confirmDialog, toast } from '@/stores/ui';
import { firstError } from '@/domain/schemas';
import { ExercisePicker } from './PlanEditor';
import { newRecordsIn, suggestProgression, completedSets, workoutVolume } from '@/domain/training';
import { celebrate } from '@/stores/celebrate';
import { XP_RULES } from '@/domain/gamification';

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function LiveWorkout() {
  const stored = useActiveWorkout();
  const nav = useNavigate();
  const [w, setW] = useState<ActiveWorkout | null>(null);
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'swap'; exId: string } | null>(null);
  const history = useWorkouts();
  const now = useNow(500);
  const beeped = useRef(false);

  useEffect(() => {
    if (stored && (!w || w.workoutId !== stored.workoutId)) setW(stored);
  }, [stored, w]);

  const update = useCallback((f: (a: ActiveWorkout) => ActiveWorkout) => {
    setW((cur) => {
      if (!cur) return cur;
      const next = f(structuredClone(cur));
      void saveActiveWorkout(next); // sofort persistieren → übersteht Neuladen
      return next;
    });
  }, []);

  const prevByExercise = useMemo(() => {
    const m = new Map<string, WorkoutExercise[]>();
    for (const h of history) for (const e of h.exercises) m.set(e.exerciseId, [...(m.get(e.exerciseId) ?? []), e]);
    return m;
  }, [history]);

  // Pausentimer
  const rest = w?.rest;
  const restRemaining = rest ? (rest.running && rest.endsAt ? Math.max(0, rest.endsAt - now) : rest.remainingMs) : 0;
  useEffect(() => {
    if (rest?.running && restRemaining === 0 && !beeped.current) {
      beeped.current = true;
      navigator.vibrate?.([200, 100, 200]);
      update((a) => ({ ...a, rest: { ...a.rest!, running: false, endsAt: null, remainingMs: 0 } }));
    }
  }, [rest?.running, restRemaining, update]);
  const startRest = (sec: number) => {
    beeped.current = false;
    update((a) => ({ ...a, rest: { running: true, endsAt: Date.now() + sec * 1000, remainingMs: sec * 1000, totalMs: sec * 1000 } }));
  };
  const toggleRest = () =>
    update((a) => {
      if (!a.rest) return a;
      if (a.rest.running) return { ...a, rest: { ...a.rest, running: false, remainingMs: Math.max(0, (a.rest.endsAt ?? 0) - Date.now()), endsAt: null } };
      beeped.current = false;
      return { ...a, rest: { ...a.rest, running: true, endsAt: Date.now() + a.rest.remainingMs } };
    });
  const resetRest = () => update((a) => (a.rest ? { ...a, rest: { ...a.rest, running: false, endsAt: null, remainingMs: a.rest.totalMs } } : a));

  if (stored === undefined) return null;
  if (!stored || !w)
    return (
      <Empty
        title="Kein laufendes Workout"
        text="Starte ein Training aus deinem Plan oder ein freies Training."
        action={
          <Button onClick={() => nav('/training')} className="mt-2">
            Zum Training
          </Button>
        }
      />
    );

  const elapsed = Math.max(0, Math.floor((now - new Date(w.startedAt).getTime()) / 1000));
  const doneSets = w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);

  const finish = async () => {
    if (!(await confirmDialog({ title: 'Training abschließen?', text: `${doneSets} abgeschlossene Sätze werden gespeichert. Nicht abgeschlossene Sätze werden verworfen.`, confirmLabel: 'Abschließen' }))) return;
    try {
      const saved = await finishWorkout();
      const prs = newRecordsIn(saved, history).filter((p) => p.kind === 'weight' || p.kind === 'e1rm');
      const byExercise = new Map([...prs].sort((a) => (a.kind === 'weight' ? 1 : -1)).map((p) => [p.exerciseId, p])); // Gewichts-PR bevorzugt anzeigen
      if (byExercise.size) {
        celebrate({
          kind: 'pr',
          title: byExercise.size === 1 ? [...byExercise.values()][0]!.name : `${byExercise.size} Bestleistungen`,
          subtitle: `+${XP_RULES.workout.xp + Math.min(5, byExercise.size) * XP_RULES.pr.xp} EP für dieses Training`,
          lines: [...byExercise.values()].map((p) => `${p.name}: ${p.detail}`),
        });
      } else toast(`Training gespeichert · ${completedSets(saved)} Sätze, ${Math.round(workoutVolume(saved)).toLocaleString('de-DE')} kg · +${XP_RULES.workout.xp} EP`, 'success');
      nav('/training/history/' + saved.id);
    } catch (e) {
      toast(firstError(e), 'error');
    }
  };
  const discard = async () => {
    if (await confirmDialog({ title: 'Workout verwerfen?', text: 'Alle Eingaben dieses Workouts gehen verloren.', danger: true, confirmLabel: 'Verwerfen' })) {
      await discardActiveWorkout();
      nav('/training');
    }
  };
  const onPick = async (ex: Exercise) => {
    const built = await buildWorkoutExercise(ex);
    if (picker?.mode === 'swap') {
      update((a) => ({ ...a, exercises: a.exercises.map((e) => (e.id === picker.exId ? { ...built, id: e.id, sets: e.sets.map((s) => ({ ...s })), restSec: e.restSec, repMin: e.repMin, repMax: e.repMax } : e)) }));
    } else update((a) => ({ ...a, exercises: [...a.exercises, built] }));
    setPicker(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={w.name}
        subtitle={
          <span className="tabular-nums" data-testid="workout-elapsed">
            Trainingszeit {formatDuration(elapsed)} · {doneSets} Sätze erledigt
          </span>
        }
      />
      <Card className="sticky top-14 z-20 flex items-center justify-between gap-2 md:top-2" data-testid="rest-timer">
        <div>
          <div className="text-xs text-muted">Pausentimer</div>
          <div className={cn('text-2xl font-bold tabular-nums', rest && restRemaining === 0 && rest.totalMs > 0 && 'text-accent')} data-testid="rest-remaining">
            {formatDuration(Math.ceil(restRemaining / 1000))}
          </div>
        </div>
        <div className="flex gap-1">
          {[60, 90, 120, 180].map((s) => (
            <Button key={s} size="sm" variant="secondary" onClick={() => startRest(s)} className="hidden sm:inline-flex">
              {s}s
            </Button>
          ))}
          <Button size="icon" variant="secondary" aria-label={rest?.running ? 'Pause anhalten' : 'Pause starten'} onClick={() => (rest ? toggleRest() : startRest(90))}>
            {rest?.running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button size="icon" variant="secondary" aria-label="Pause zurücksetzen" onClick={resetRest} disabled={!rest}>
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
      </Card>

      {w.exercises.map((e) => {
        const prev = prevByExercise.get(e.exerciseId);
        const last = prev?.[prev.length - 1];
        const sugg = e.repMin && e.repMax && prev ? suggestProgression(prev, e.repMin, e.repMax) : null;
        return (
          <Card key={e.id} data-testid="workout-exercise">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">{e.name}</div>
                <div className="text-xs text-muted">
                  {e.primaryMuscle} {e.repMin && e.repMax ? `· Ziel ${e.repMin}–${e.repMax} Wdh.` : ''} · Pause {e.restSec}s
                </div>
                {sugg && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-accent">
                    <TrendingUp className="h-3.5 w-3.5" /> {sugg.action === 'increase' ? `Vorschlag: ${sugg.nextWeightKg} kg` : sugg.action === 'decrease' ? `Vorschlag: ${sugg.nextWeightKg} kg (Entlastung)` : 'Gewicht halten'} – {sugg.reason}
                  </div>
                )}
              </div>
              <div className="flex">
                <Button variant="ghost" size="icon" aria-label="Übung wechseln" onClick={() => setPicker({ mode: 'swap', exId: e.id })}>
                  <Repeat className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Übung entfernen" onClick={() => update((a) => ({ ...a, exercises: a.exercises.filter((x) => x.id !== e.id) }))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-[2rem_1fr_1fr_1fr_3rem] items-center gap-2 text-xs text-muted">
              <span>Satz</span>
              <span>Vorher</span>
              <span>kg</span>
              <span>Wdh.</span>
              <span />
            </div>
            {e.sets.map((s, i) => {
              const p = last?.sets[i];
              return (
                <div key={s.id} className={cn('mt-1 grid grid-cols-[2rem_1fr_1fr_1fr_3rem] items-center gap-2 rounded-xl', s.done && 'bg-accent/10')} data-testid="set-row">
                  <span className="pl-2 text-sm font-medium">{i + 1}</span>
                  <span className="truncate text-xs text-muted">{p ? `${fmt(p.weightKg, 1)}×${p.reps}` : '–'}</span>
                  <NumberInput aria-label={`Satz ${i + 1} Gewicht`} className="h-10 px-2" value={s.weightKg} onValue={(v) => update((a) => ({ ...a, exercises: a.exercises.map((x) => (x.id === e.id ? { ...x, sets: x.sets.map((y) => (y.id === s.id ? { ...y, weightKg: v ?? null } : y)) } : x)) }))} />
                  <NumberInput aria-label={`Satz ${i + 1} Wiederholungen`} className="h-10 px-2" value={s.reps} placeholder={p?.reps ? String(p.reps) : e.repMax ? String(e.repMax) : ''} onValue={(v) => update((a) => ({ ...a, exercises: a.exercises.map((x) => (x.id === e.id ? { ...x, sets: x.sets.map((y) => (y.id === s.id ? { ...y, reps: v ?? null } : y)) } : x)) }))} />
                  <Button
                    size="icon"
                    variant={s.done ? 'primary' : 'secondary'}
                    aria-label={`Satz ${i + 1} ${s.done ? 'offen markieren' : 'abschließen'}`}
                    aria-pressed={s.done}
                    onClick={() => {
                      const willBeDone = !s.done;
                      if (willBeDone && (s.reps == null || s.reps <= 0)) {
                        // Ein-Klick-Abschluss: Platzhalterwert (letzte Wdh. bzw. Ziel) übernehmen
                        const fallback = p?.reps ?? e.repMax ?? null;
                        if (!fallback) return toast('Bitte zuerst Wiederholungen eintragen.', 'error');
                        update((a) => ({ ...a, exercises: a.exercises.map((x) => (x.id === e.id ? { ...x, sets: x.sets.map((y) => (y.id === s.id ? { ...y, reps: fallback, done: true } : y)) } : x)) }));
                      } else update((a) => ({ ...a, exercises: a.exercises.map((x) => (x.id === e.id ? { ...x, sets: x.sets.map((y) => (y.id === s.id ? { ...y, done: willBeDone } : y)) } : x)) }));
                      if (willBeDone && e.restSec > 0) startRest(e.restSec);
                    }}
                  >
                    <Check className="h-5 w-5" />
                  </Button>
                </div>
              );
            })}
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update((a) => ({ ...a, exercises: a.exercises.map((x) => (x.id === e.id ? { ...x, sets: [...x.sets, { id: uid(), weightKg: x.sets[x.sets.length - 1]?.weightKg ?? null, reps: null, done: false }] } : x)) }))}
              >
                <Plus className="h-4 w-4" /> Satz
              </Button>
              {e.sets.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => update((a) => ({ ...a, exercises: a.exercises.map((x) => (x.id === e.id ? { ...x, sets: x.sets.slice(0, -1) } : x)) }))}>
                  Satz entfernen
                </Button>
              )}
            </div>
          </Card>
        );
      })}
      <Button variant="outline" className="w-full" onClick={() => setPicker({ mode: 'add' })}>
        <Plus className="h-4 w-4" /> Übung hinzufügen
      </Button>
      <Card>
        <div className="mb-1 text-xs font-medium text-muted">Notizen</div>
        <Textarea aria-label="Workout-Notizen" value={w.notes} onChange={(ev) => update((a) => ({ ...a, notes: ev.target.value }))} />
      </Card>
      <div className="flex gap-2">
        <Button variant="ghost" className="text-danger" onClick={discard}>
          Verwerfen
        </Button>
        <Button className="flex-1" size="lg" onClick={finish}>
          Training abschließen
        </Button>
      </div>
      {w.planId && <Badge>Werte aus dem Plan sind Vorschläge – geänderte Pläne beeinflussen dieses Workout nicht.</Badge>}
      {picker && <ExercisePicker onClose={() => setPicker(null)} onPick={onPick} />}
    </div>
  );
}
