import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, Plus, Trash2, Search } from 'lucide-react';
import { Button, Card, Field, Input, NumberInput, Select, Sheet, Textarea, cn } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { db } from '@/data/db';
import type { Exercise, Plan, PlanDay, PlanExercise } from '@/domain/types';
import { savePlan, searchExercises, setPlanStatus } from '@/data/trainingRepo';
import { WEEKDAY_SHORT, uid } from '@/domain/dates';
import { useExercises } from '@/hooks/data';
import { toast } from '@/stores/ui';
import { firstError } from '@/domain/schemas';
import { SPLIT_LABELS, ExerciseForm } from './Training';
import { MUSCLE_GROUPS } from '@/data/exerciseLibrary';

export function PlanEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const stored = useLiveQuery(() => db.plans.get(id!), [id]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const exercises = useExercises();
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  useEffect(() => {
    if (stored && !plan) setPlan(structuredClone(stored));
  }, [stored, plan]);
  if (stored === undefined && !plan) return null;
  if (!plan) return <p className="text-muted">Plan nicht gefunden.</p>;

  const updDay = (dayId: string, f: (d: PlanDay) => PlanDay) => setPlan({ ...plan, days: plan.days.map((d) => (d.id === dayId ? f(d) : d)) });
  const updEx = (dayId: string, exId: string, patch: Partial<PlanExercise>) => updDay(dayId, (d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)) }));
  const move = (dayId: string, idx: number, dir: -1 | 1) =>
    updDay(dayId, (d) => {
      const list = [...d.exercises];
      const j = idx + dir;
      if (j < 0 || j >= list.length) return d;
      [list[idx], list[j]] = [list[j]!, list[idx]!];
      return { ...d, exercises: list };
    });

  const save = async (activate = false) => {
    try {
      await savePlan(plan);
      if (activate) await setPlanStatus(plan.id, 'active');
      toast(activate ? 'Plan gespeichert und aktiviert' : 'Plan gespeichert', 'success');
      nav('/training');
    } catch (e) {
      toast(firstError(e), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Plan bearbeiten" />
      <Card className="space-y-3">
        <Field label="Planname">{(i) => <Input id={i} value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ziel">{(i) => <Input id={i} value={plan.goal} placeholder="z. B. Hypertrophie" onChange={(e) => setPlan({ ...plan, goal: e.target.value })} />}</Field>
          <Field label="Trainingsart">
            {(i) => (
              <Select id={i} value={plan.split} onChange={(e) => setPlan({ ...plan, split: e.target.value as Plan['split'] })}>
                {Object.entries(SPLIT_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Notizen">{(i) => <Textarea id={i} value={plan.notes} onChange={(e) => setPlan({ ...plan, notes: e.target.value })} />}</Field>
      </Card>

      {plan.days.map((d) => (
        <Card key={d.id} className="space-y-3" data-testid="plan-day">
          <div className="flex items-end gap-2">
            <Field label="Trainingstag" className="flex-1">
              {(i) => <Input id={i} value={d.name} onChange={(e) => updDay(d.id, (x) => ({ ...x, name: e.target.value }))} />}
            </Field>
            <Button variant="ghost" size="icon" aria-label="Trainingstag entfernen" onClick={() => setPlan({ ...plan, days: plan.days.filter((x) => x.id !== d.id) })}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1" aria-label="Wochentage">
            {WEEKDAY_SHORT.map((w, i) => {
              const on = d.weekdays.includes(i + 1);
              return (
                <button key={w} type="button" aria-pressed={on} onClick={() => updDay(d.id, (x) => ({ ...x, weekdays: on ? x.weekdays.filter((y) => y !== i + 1) : [...x.weekdays, i + 1].sort() }))} className={cn('h-9 flex-1 rounded-lg text-xs font-medium', on ? 'bg-accent text-white' : 'bg-fg/[0.06] text-muted')}>
                  {w}
                </button>
              );
            })}
          </div>
          <ul className="space-y-2">
            {d.exercises.map((e, idx) => {
              const ex = exMap.get(e.exerciseId);
              return (
                <li key={e.id} className="rounded-xl border p-3" data-testid="plan-exercise">
                  <div className="mb-2 flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{ex?.name ?? e.exerciseId}</div>
                      <div className="text-xs text-muted">{ex?.primaryMuscle}</div>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Nach oben" onClick={() => move(d.id, idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Nach unten" onClick={() => move(d.id, idx, 1)} disabled={idx === d.exercises.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Übung entfernen" onClick={() => updDay(d.id, (x) => ({ ...x, exercises: x.exercises.filter((y) => y.id !== e.id) }))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    <Field label="Sätze">{(i) => <NumberInput id={i} value={e.sets} onValue={(v) => updEx(d.id, e.id, { sets: v ?? 0 })} />}</Field>
                    <Field label="Wdh. min">{(i) => <NumberInput id={i} value={e.repMin} onValue={(v) => updEx(d.id, e.id, { repMin: v ?? 0 })} />}</Field>
                    <Field label="Wdh. max">{(i) => <NumberInput id={i} value={e.repMax} onValue={(v) => updEx(d.id, e.id, { repMax: v ?? 0 })} />}</Field>
                    <Field label="Zielgew. kg">{(i) => <NumberInput id={i} value={e.targetWeightKg} onValue={(v) => updEx(d.id, e.id, { targetWeightKg: v })} />}</Field>
                    <Field label="Pause s">{(i) => <NumberInput id={i} value={e.restSec} onValue={(v) => updEx(d.id, e.id, { restSec: v ?? 0 })} />}</Field>
                    <Field label="RIR (opt.)">{(i) => <NumberInput id={i} value={e.rir} onValue={(v) => updEx(d.id, e.id, { rir: v })} />}</Field>
                  </div>
                  <Input aria-label="Notiz zur Übung" className="mt-2 h-9 text-sm" placeholder="Notiz (optional)" value={e.notes ?? ''} onChange={(ev) => updEx(d.id, e.id, { notes: ev.target.value })} />
                </li>
              );
            })}
          </ul>
          <Button variant="secondary" onClick={() => setPickFor(d.id)}>
            <Plus className="h-4 w-4" /> Übung hinzufügen
          </Button>
        </Card>
      ))}
      <Button variant="outline" onClick={() => setPlan({ ...plan, days: [...plan.days, { id: uid(), name: `Tag ${String.fromCharCode(65 + plan.days.length)}`, weekdays: [], exercises: [] }] })}>
        <Plus className="h-4 w-4" /> Trainingstag hinzufügen
      </Button>
      <div className="sticky bottom-20 z-10 flex gap-2 md:bottom-4">
        <Button className="flex-1" variant="secondary" onClick={() => save(false)}>
          Speichern
        </Button>
        {plan.status !== 'active' && (
          <Button className="flex-1" onClick={() => save(true)}>
            Speichern & aktivieren
          </Button>
        )}
      </div>
      {pickFor && (
        <ExercisePicker
          onClose={() => setPickFor(null)}
          onPick={(ex) => {
            updDay(pickFor, (d) => ({ ...d, exercises: [...d.exercises, { id: uid(), exerciseId: ex.id, sets: 3, repMin: 8, repMax: 12, restSec: 90 }] }));
            setPickFor(null);
          }}
        />
      )}
    </div>
  );
}

export function ExercisePicker({ onClose, onPick }: { onClose: () => void; onPick: (e: Exercise) => void }) {
  const all = useExercises();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [create, setCreate] = useState(false);
  const list = useMemo(() => searchExercises(all, q, muscle || undefined), [all, q, muscle]);
  return (
    <Sheet open onClose={onClose} title="Übung wählen">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted" />
          <Input aria-label="Übung suchen" className="pl-10" placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label="Muskelgruppe" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">Alle Muskelgruppen</option>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
        <ul className="divide-y">
          {list.map((e) => (
            <li key={e.id}>
              <button className="w-full py-2 text-left" onClick={() => onPick(e)}>
                <div className="text-sm font-medium">{e.name}</div>
                <div className="text-xs text-muted">
                  {e.primaryMuscle} · {e.equipment}
                </div>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" onClick={() => setCreate(true)}>
          <Plus className="h-4 w-4" /> Eigene Übung anlegen
        </Button>
      </div>
      {create && <ExerciseForm onClose={() => setCreate(false)} onSaved={onPick} />}
    </Sheet>
  );
}
