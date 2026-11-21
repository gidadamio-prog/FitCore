import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Field, NumberInput, Stat, fmt } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { db } from '@/data/db';
import { useExercises, useWorkouts } from '@/hooks/data';
import { completedSets, exerciseHistory, exerciseVolume, personalRecords, setsPerMuscle, totalReps, workoutVolume, epley1RM, isCompletedSet } from '@/domain/training';
import { formatDate, formatDuration } from '@/domain/dates';
import { clearWorkoutKcalOverride, deleteWorkout, updateWorkout } from '@/data/trainingRepo';
import { confirmDialog, toast } from '@/stores/ui';
import { firstError } from '@/domain/schemas';
import { LineSeriesChart, SERIES } from '@/components/charts';

export function WorkoutDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const w = useLiveQuery(() => db.workouts.get(id!), [id]);
  const all = useWorkouts();
  const [kcal, setKcal] = useState<number | undefined>();
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
      <Card className="space-y-2">
        <CardTitle>Trainingsenergie</CardTitle>
        <p className="text-xs text-muted">
          Geschätzt: {fmt(w.estimatedKcal)} kcal (Netto-MET 5 × {w.bodyWeightKg ? fmt(w.bodyWeightKg, 1) + ' kg' : 'unbekanntes Körpergewicht'} × Dauer). Du kannst einen eigenen Wert setzen, z. B. von einer Pulsuhr.
        </p>
        <div className="flex items-end gap-2">
          <Field label="Eigener Wert (kcal)" className="flex-1">
            {(i) => <NumberInput id={i} value={kcal ?? w.kcalOverride} onValue={setKcal} />}
          </Field>
          <Button
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
