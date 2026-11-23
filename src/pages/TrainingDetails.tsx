import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Field, Input, NumberInput, Stat, fmt } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { db } from '@/data/db';
import { useExercises, useWorkouts } from '@/hooks/data';
import { completedSets, exerciseHistory, exerciseVolume, personalRecords, setsPerMuscle, totalReps, workoutVolume, epley1RM, isCompletedSet } from '@/domain/training';
import { formatDate, formatDuration } from '@/domain/dates';
import { clearWorkoutKcalOverride, deleteWorkout, updateWorkout, updateWorkoutDuration } from '@/data/trainingRepo';
import { confirmDialog, toast } from '@/stores/ui';
import { firstError } from '@/domain/schemas';
import { LineSeriesChart, SERIES } from '@/components/charts';
import type { Workout } from '@/domain/types';

export function WorkoutDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const w = useLiveQuery(() => db.workouts.get(id!), [id]);
  const all = useWorkouts();
  const [kcal, setKcal] = useState<number | undefined>();
  const [mins, setMins] = useState<number | undefined>();
  const prs = useMemo(() => (w ? personalRecords(all).filter((p) => p.workoutId === w.id) : []), [all, w]);
  if (w === undefined) return null;
  if (!w) return <p className="text-muted">Workout nicht gefunden.</p>;
  const muscles = Object.entries(setsPerMuscle([w])).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-4">
      <PageHeader title={w.name} subtitle={`${formatDate(w.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${new Date(w.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`} />
      <Card className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Dauer" value={formatDuration(w.durationSec)} />
        <Stat label="Volumen" value={<span data-testid="detail-volume">{fmt(workoutVolume(w))}</span>} unit="kg" />
        <Stat label="Sätze / Wdh." value={`${completedSets(w)} / ${totalReps(w)}`} />
        <Stat label="Energie" value={fmt(w.kcalOverride ?? w.estimatedKcal)} unit="kcal" sub={w.kcalOverride != null ? 'manuell' : 'Schätzung (MET)'} />
      </Card>
      {prs.length > 0 && (
        <Card>
          <CardTitle>Bestleistungen in diesem Workout</CardTitle>
          <div className="flex flex-wrap gap-2">
            {prs.map((p) => (
              <Badge key={p.exerciseId + p.kind} tone="accent">
                {p.name}: {p.detail}
              </Badge>
            ))}
          </div>
        </Card>
      )}
      {w.exercises.map((e) => (
        <Card key={e.id}>
          <CardTitle action={<span className="text-xs text-muted">{fmt(exerciseVolume(e))} kg</span>}>
            <button className="text-left hover:underline" onClick={() => nav('/training/exercise/' + e.exerciseId)}>
              {e.name}
            </button>
          </CardTitle>
          <table className="w-full text-sm">
            <tbody>
              {e.sets.map((s, i) => (
                <tr key={s.id} className="border-t">
                  <td className="py-1.5 text-muted">Satz {i + 1}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.weightKg != null ? `${fmt(s.weightKg, 2)} kg` : 'Körpergewicht'}</td>
                  <td className="py-1.5 text-right tabular-nums">× {s.reps}</td>
                  <td className="py-1.5 text-right text-xs text-muted">{s.weightKg && s.reps && s.reps <= 12 ? `e1RM ${fmt(epley1RM(s.weightKg, s.reps), 1)}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
      <Card>
        <CardTitle>Sätze pro Muskelgruppe</CardTitle>
        <ul className="grid grid-cols-2 gap-1 text-sm">
          {muscles.map(([m, n]) => (
            <li key={m} className="flex justify-between">
              <span className="text-muted">{m}</span>
              <span className="tabular-nums">{fmt(n, 1)}</span>
            </li>
          ))}
        </ul>
      </Card>
      {w.notes && (
        <Card>
          <CardTitle>Notizen</CardTitle>
          <p className="whitespace-pre-line text-sm">{w.notes}</p>
        </Card>
      )}
      <DurationCard w={w} mins={mins} setMins={setMins} />
      <Card className="space-y-2">
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Eigener kcal-Wert (z. B. von einer Pulsuhr)</summary>
          <p className="mt-2 text-xs text-muted">
            Normalerweise wird die Energie aus der Dauer geschätzt (Netto-MET 5 × {w.bodyWeightKg ? fmt(w.bodyWeightKg, 1) + ' kg' : 'unbekanntes Körpergewicht'} × Dauer). Ein eigener Wert ersetzt diese Schätzung.
          </p>
          <div className="mt-2 flex items-end gap-2">
            <Field label="Eigener Wert (kcal)" className="flex-1">
              {(i) => <NumberInput id={i} value={kcal ?? w.kcalOverride} onValue={setKcal} />}
            </Field>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  if (kcal == null) await clearWorkoutKcalOverride(w.id);
                  else await updateWorkout(w.id, { kcalOverride: kcal });
                  toast('Energiebilanz aktualisiert', 'success');
                } catch (e) {
                  toast(firstError(e), 'error');
                }
              }}
            >
              Übernehmen
            </Button>
          </div>
        </details>
      </Card>
      <Button
        variant="ghost"
        className="text-danger"
        onClick={async () => {
          if (await confirmDialog({ title: 'Workout löschen?', text: 'Das Workout und seine angerechnete Energie werden entfernt.', danger: true, confirmLabel: 'Löschen' })) {
            await deleteWorkout(w.id);
            nav('/training?tab=history');
          }
        }}
      >
        <Trash2 className="h-4 w-4" /> Workout löschen
      </Button>
    </div>
  );
}

export function ExerciseDetail() {
  const { id } = useParams();
  const exercises = useExercises();
  const workouts = useWorkouts();
  const nav = useNavigate();
  const ex = exercises.find((e) => e.id === id);
  const hist = useMemo(() => exerciseHistory(workouts, id!), [workouts, id]);
  const prs = useMemo(() => personalRecords(workouts).filter((p) => p.exerciseId === id), [workouts, id]);
  const repPRs = useMemo(() => {
    // Wiederholungsbestleistung je Gewicht
    const m = new Map<number, number>();
    for (const w of workouts) for (const e of w.exercises) if (e.exerciseId === id) for (const s of e.sets.filter(isCompletedSet)) if (s.weightKg) m.set(s.weightKg, Math.max(m.get(s.weightKg) ?? 0, s.reps!));
    return [...m.entries()].sort((a, b) => b[0] - a[0]).slice(0, 8);
  }, [workouts, id]);
  if (!ex) return <p className="text-muted">Übung nicht gefunden.</p>;
  const label = { weight: 'Höchstes Gewicht', e1rm: 'Geschätztes 1RM', reps: 'Meiste Wdh.', volume: 'Volumen/Einheit' };
  return (
    <div className="space-y-4">
      <PageHeader title={ex.name} subtitle={`${ex.primaryMuscle}${ex.secondaryMuscles.length ? ' + ' + ex.secondaryMuscles.join(', ') : ''} · ${ex.equipment}`} />
      {ex.description && (
        <Card>
          <p className="text-sm">{ex.description}</p>
          {ex.alternatives.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              <span className="text-muted">Alternativen:</span>
              {ex.alternatives.map((a) => (
                <button key={a} className="text-accent underline" onClick={() => nav('/training/exercise/' + a)}>
                  {exercises.find((e) => e.id === a)?.name ?? a}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}
      <Card>
        <CardTitle>Verlauf ({hist.length} Einheiten)</CardTitle>
        <LineSeriesChart
          data={hist.map((h) => ({ date: h.date, top: h.topWeight, e1rm: h.bestE1RM }))}
          series={[
            { key: 'top', label: 'Höchstes Gewicht', color: SERIES.s1, unit: 'kg', dots: true, digits: 1 },
            { key: 'e1rm', label: 'Geschätztes 1RM', color: SERIES.s2, unit: 'kg', dots: true, dashed: true, digits: 1 },
          ]}
        />
      </Card>
      <Card>
        <CardTitle>Volumen je Einheit</CardTitle>
        <LineSeriesChart data={hist.map((h) => ({ date: h.date, volume: h.volume }))} series={[{ key: 'volume', label: 'Volumen', color: SERIES.s3, unit: 'kg', dots: true }]} />
      </Card>
      {prs.length > 0 && (
        <Card>
          <CardTitle>Bestleistungen</CardTitle>
          <ul className="space-y-1 text-sm">
            {prs.map((p) => (
              <li key={p.kind} className="flex justify-between">
                <span className="text-muted">{label[p.kind]}</span>
                <span>
                  {p.detail} · {formatDate(p.date, { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
          {repPRs.length > 0 && (
            <>
              <div className="mt-3 text-xs font-medium text-muted">Wiederholungsbestleistung je Gewicht</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                {repPRs.map(([kg, reps]) => (
                  <Badge key={kg}>
                    {fmt(kg, 2)} kg × {reps}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

const hhmm = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Dauer korrigieren, z. B. wenn „Training abschließen“ vergessen wurde – per Minuten oder Endzeit. */
function DurationCard({ w, mins, setMins }: { w: Workout; mins: number | undefined; setMins: (v: number | undefined) => void }) {
  const start = new Date(w.startedAt);
  const current = Math.round(w.durationSec / 60);
  const value = mins ?? current;
  const end = new Date(start.getTime() + value * 60_000);
  const setEnd = (t: string) => {
    const [h, m] = t.split(':').map(Number) as [number, number];
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const e = new Date(start);
    e.setHours(h, m, 0, 0);
    if (e <= start) e.setDate(e.getDate() + 1); // über Mitternacht
    setMins(Math.round((e.getTime() - start.getTime()) / 60_000));
  };
  return (
    <Card className="space-y-2" data-testid="duration-card">
      <CardTitle>Dauer anpassen</CardTitle>
      <p className="text-xs text-muted">
        „Abschließen“ vergessen? Trag die echte Dauer oder Endzeit ein – die Trainingsenergie ({fmt(w.estimatedKcal)} kcal geschätzt) wird daraus neu berechnet.
      </p>
      <div className="grid grid-cols-3 items-end gap-2">
        <Field label="Start">{(i) => <Input id={i} value={hhmm(start)} disabled />}</Field>
        <Field label="Ende">{(i) => <Input id={i} type="time" value={hhmm(end)} onChange={(e) => setEnd(e.target.value)} />}</Field>
        <Field label="Dauer (Min.)">{(i) => <NumberInput id={i} value={value} onValue={setMins} />}</Field>
      </div>
      <Button
        className="w-full"
        disabled={mins == null || mins === current}
        onClick={async () => {
          try {
            await updateWorkoutDuration(w.id, value);
            setMins(undefined);
            toast(`Dauer auf ${formatDuration(value * 60)} gesetzt – Energie neu geschätzt`, 'success');
          } catch (e) {
            toast(firstError(e), 'error');
          }
        }}
      >
        Dauer übernehmen
      </Button>
    </Card>
  );
}
