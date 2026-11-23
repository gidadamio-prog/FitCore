import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, Plus, Trash2, Layers, CheckSquare, Square } from 'lucide-react';
import { Button, Card, Field, Input, NumberInput, Select, Sheet, Textarea, cn } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { db } from '@/data/db';
import type { Exercise, Plan, PlanDay, PlanExercise, PlanGroup } from '@/domain/types';
import { savePlan, setPlanStatus } from '@/data/trainingRepo';
import { WEEKDAY_SHORT, uid } from '@/domain/dates';
import { useExercises } from '@/hooks/data';
import { confirmDialog, toast } from '@/stores/ui';
import { firstError } from '@/domain/schemas';
import { SPLIT_LABELS, ExerciseForm } from './Training';
import { ExerciseBrowser } from '@/components/ExerciseBrowser';

export function PlanEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const stored = useLiveQuery(() => db.plans.get(id!), [id]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pickFor, setPickFor] = useState<{ dayId: string; groupId?: string } | null>(null);
  const [sel, setSel] = useState<{ dayId: string; ids: string[] } | null>(null);
  const exercises = useExercises();
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  useEffect(() => {
    if (stored && !plan) setPlan(structuredClone(stored));
  }, [stored, plan]);
  if (stored === undefined && !plan) return null;
  if (!plan) return <p className="text-muted">Plan nicht gefunden.</p>;

  const updDay = (dayId: string, f: (d: PlanDay) => PlanDay) => setPlan({ ...plan, days: plan.days.map((d) => (d.id === dayId ? f(d) : d)) });
  const updEx = (dayId: string, exId: string, patch: Partial<PlanExercise>) => updDay(dayId, (d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)) }));
  const updGroup = (dayId: string, gId: string, patch: Partial<PlanGroup>) => updDay(dayId, (d) => ({ ...d, groups: (d.groups ?? []).map((g) => (g.id === gId ? { ...g, ...patch } : g)) }));
  /** Block (einzelne Übung oder ganze Einheit) im Tag nach oben/unten verschieben */
  const moveBlock = (dayId: string, blockIdx: number, dir: -1 | 1) =>
    updDay(dayId, (d) => {
      const blocks = blocksOf(d).map((b) => (b.kind === 'single' ? [b.ex] : b.members));
      const j = blockIdx + dir;
      if (j < 0 || j >= blocks.length) return d;
      [blocks[blockIdx], blocks[j]] = [blocks[j]!, blocks[blockIdx]!];
      return { ...d, exercises: blocks.flat() };
    });
  /** Übung innerhalb ihrer Einheit verschieben */
  const moveInGroup = (dayId: string, exId: string, dir: -1 | 1) =>
    updDay(dayId, (d) => {
      const list = [...d.exercises];
      const i = list.findIndex((e) => e.id === exId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length || list[j]!.groupId !== list[i]!.groupId) return d;
      [list[i], list[j]] = [list[j]!, list[i]!];
      return { ...d, exercises: list };
    });
  const removeEx = (dayId: string, exId: string) => updDay(dayId, (x) => ({ ...x, exercises: x.exercises.filter((y) => y.id !== exId) }));
  const addGroup = (dayId: string) => {
    const g: PlanGroup = { id: uid(), name: 'Zirkel', rounds: 2, restSec: 90 };
    updDay(dayId, (d) => ({ ...d, groups: [...(d.groups ?? []), g] }));
    setPickFor({ dayId, groupId: g.id });
  };
  const removeGroup = async (dayId: string, g: PlanGroup, count: number) => {
    if (count && !(await confirmDialog({ title: 'Einheit entfernen?', text: `„${g.name}“ und ihre ${count} Übung(en) werden aus dem Trainingstag entfernt.`, confirmLabel: 'Entfernen', danger: true }))) return;
    updDay(dayId, (d) => ({ ...d, groups: (d.groups ?? []).filter((x) => x.id !== g.id), exercises: d.exercises.filter((e) => e.groupId !== g.id) }));
  };
  /** Ausgewählte Einzelübungen zu einer neuen Einheit zusammenfassen (an der Stelle der ersten) */
  const mergeToGroup = (dayId: string, ids: string[], target?: PlanGroup) => {
    updDay(dayId, (d) => {
      const picked = d.exercises.filter((e) => ids.includes(e.id));
      if (!picked.length) return d;
      const counts = new Map<number, number>();
      for (const e of picked) counts.set(e.sets, (counts.get(e.sets) ?? 0) + 1);
      const rounds = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || 2;
      const g: PlanGroup = target ?? { id: uid(), name: 'Zirkel', rounds: Math.min(20, Math.max(1, rounds)), restSec: 90 };
      const moved = picked.map((e) => ({ ...e, groupId: g.id, restSec: 0 }));
      const rest = d.exercises.filter((e) => !ids.includes(e.id));
      let at: number;
      if (target) {
        const last = rest.map((e) => e.groupId).lastIndexOf(target.id);
        at = last === -1 ? rest.length : last + 1;
      } else at = d.exercises.findIndex((e) => ids.includes(e.id)); // vor der ersten Auswahl steht keine ausgewählte Übung
      rest.splice(at, 0, ...moved);
      return { ...d, exercises: rest, groups: target ? d.groups : [...(d.groups ?? []), g] };
    });
    setSel(null);
    toast(target ? `${ids.length} Übung(en) zu „${target.name}“ hinzugefügt` : `Einheit aus ${ids.length} Übungen gebildet – Name, Durchgänge und Pause anpassen`, 'success');
  };
  const dissolveGroup = (dayId: string, gId: string) =>
    updDay(dayId, (d) => ({
      ...d,
      groups: (d.groups ?? []).filter((x) => x.id !== gId),
      exercises: d.exercises.map((e) => (e.groupId === gId ? { ...e, groupId: undefined, sets: e.sets || 1, restSec: e.restSec || 60 } : e)),
    }));

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
                <button key={w} type="button" aria-pressed={on} onClick={() => updDay(d.id, (x) => ({ ...x, weekdays: on ? x.weekdays.filter((y) => y !== i + 1) : [...x.weekdays, i + 1].sort() }))} className={cn('h-9 flex-1 rounded-lg text-xs font-medium', on ? 'bg-accent text-accent-fg' : 'bg-fg/[0.06] text-muted')}>
                  {w}
                </button>
              );
            })}
          </div>
          <ul className="space-y-2">
            {blocksOf(d).map((b, bi, all) => {
              const blockMove = (
                <>
                  <Button variant="ghost" size="icon" aria-label="Nach oben" onClick={() => moveBlock(d.id, bi, -1)} disabled={bi === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Nach unten" onClick={() => moveBlock(d.id, bi, 1)} disabled={bi === all.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </>
              );
              if (b.kind === 'single') {
                const e = b.ex;
                const selecting = sel?.dayId === d.id;
                const checked = !!sel?.ids.includes(e.id);
                return (
                  <li key={e.id} className={cn('rounded-xl border p-3', checked && 'border-gold bg-gold/[0.06]')} data-testid="plan-exercise">
                    <ExerciseHead
                      name={exMap.get(e.exerciseId)?.name ?? e.exerciseId}
                      muscle={exMap.get(e.exerciseId)?.primaryMuscle}
                      lead={
                        selecting ? (
                          <button type="button" aria-pressed={checked} aria-label={`Auswählen: ${exMap.get(e.exerciseId)?.name ?? e.exerciseId}`} className="text-gold" onClick={() => setSel({ dayId: d.id, ids: checked ? sel!.ids.filter((x) => x !== e.id) : [...sel!.ids, e.id] })}>
                            {checked ? <CheckSquare className="h-6 w-6" /> : <Square className="h-6 w-6 text-muted" />}
                          </button>
                        ) : null
                      }
                    >
                      {blockMove}
                      <Button variant="ghost" size="icon" aria-label="Übung entfernen" onClick={() => removeEx(d.id, e.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ExerciseHead>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      <Field label="Sätze">{(i) => <NumberInput id={i} value={e.sets} onValue={(v) => updEx(d.id, e.id, { sets: v as number })} />}</Field>
                      <RepFields e={e} onPatch={(patch) => updEx(d.id, e.id, patch)} />
                      <Field label="Zielgew. kg">{(i) => <NumberInput id={i} value={e.targetWeightKg} onValue={(v) => updEx(d.id, e.id, { targetWeightKg: v })} />}</Field>
                      <Field label="Pause s">{(i) => <NumberInput id={i} value={e.restSec} onValue={(v) => updEx(d.id, e.id, { restSec: v as number })} />}</Field>
                      <Field label="RIR (opt.)">{(i) => <NumberInput id={i} value={e.rir} onValue={(v) => updEx(d.id, e.id, { rir: v })} />}</Field>
                    </div>
                    <Input aria-label="Notiz zur Übung" className="mt-2 h-9 text-sm" placeholder="Notiz (optional)" value={e.notes ?? ''} onChange={(ev) => updEx(d.id, e.id, { notes: ev.target.value })} />
                  </li>
                );
              }
              const g = b.group;
              return (
                <li key={g.id} className="rounded-2xl border-2 border-gold/40 bg-gold/[0.04] p-3" data-testid="plan-group">
                  <div className="mb-2 flex items-center gap-1">
                    <Layers className="h-4 w-4 shrink-0 text-gold" />
                    <Input aria-label="Name der Einheit" className="h-9 flex-1 font-semibold" value={g.name} onChange={(ev) => updGroup(d.id, g.id, { name: ev.target.value })} />
                    {blockMove}
                    <Button variant="ghost" size="icon" aria-label="Einheit entfernen" onClick={() => void removeGroup(d.id, g, b.members.length)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Durchgänge">{(i) => <NumberInput id={i} value={g.rounds} onValue={(v) => updGroup(d.id, g.id, { rounds: v as number })} />}</Field>
                    <Field label="Pause nach Durchgang s">{(i) => <NumberInput id={i} value={g.restSec} onValue={(v) => updGroup(d.id, g.id, { restSec: v as number })} />}</Field>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {b.members.map((e, mi) => (
                      <li key={e.id} className="rounded-xl border bg-card p-2.5" data-testid="plan-group-exercise">
                        <ExerciseHead name={`${mi + 1}. ${exMap.get(e.exerciseId)?.name ?? e.exerciseId}`} muscle={exMap.get(e.exerciseId)?.primaryMuscle}>
                          <Button variant="ghost" size="icon" aria-label="In der Einheit nach oben" onClick={() => moveInGroup(d.id, e.id, -1)} disabled={mi === 0}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="In der Einheit nach unten" onClick={() => moveInGroup(d.id, e.id, 1)} disabled={mi === b.members.length - 1}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Übung aus der Einheit entfernen" onClick={() => removeEx(d.id, e.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ExerciseHead>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <RepFields e={e} onPatch={(patch) => updEx(d.id, e.id, patch)} />
                          <Field label="Zielgew. kg">{(i) => <NumberInput id={i} value={e.targetWeightKg} onValue={(v) => updEx(d.id, e.id, { targetWeightKg: v })} />}</Field>
                          <Field label="Wechsel s">{(i) => <NumberInput id={i} value={e.restSec} onValue={(v) => updEx(d.id, e.id, { restSec: v as number })} />}</Field>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setPickFor({ dayId: d.id, groupId: g.id })}>
                      <Plus className="h-4 w-4" /> Übung zur Einheit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dissolveGroup(d.id, g.id)}>
                      Einheit auflösen
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {sel?.dayId === d.id ? (
            <div className="sticky bottom-20 z-10 space-y-2 rounded-2xl border-2 border-gold/50 bg-card p-3 shadow-lg md:bottom-4" data-testid="merge-bar">
              <div className="text-sm font-medium">{sel.ids.length ? `${sel.ids.length} Übung(en) ausgewählt` : 'Übungen antippen, die zusammengehören'}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={sel.ids.length < 1} onClick={() => mergeToGroup(d.id, sel.ids)}>
                  <Layers className="h-4 w-4" /> Als Einheit zusammenfassen
                </Button>
                {(d.groups ?? []).map((g) => (
                  <Button key={g.id} size="sm" variant="secondary" disabled={sel.ids.length < 1} onClick={() => mergeToGroup(d.id, sel.ids, g)}>
                    Zu „{g.name}“
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setSel(null)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setPickFor({ dayId: d.id })}>
                <Plus className="h-4 w-4" /> Übung hinzufügen
              </Button>
              <Button variant="secondary" onClick={() => addGroup(d.id)}>
                <Layers className="h-4 w-4" /> Einheit hinzufügen
              </Button>
              {d.exercises.some((e) => !e.groupId || !(d.groups ?? []).some((g) => g.id === e.groupId)) && (
                <Button variant="ghost" onClick={() => setSel({ dayId: d.id, ids: [] })}>
                  <CheckSquare className="h-4 w-4" /> Zusammenfassen
                </Button>
              )}
            </div>
          )}
        </Card>
      ))}
      <Button variant="outline" onClick={() => setPlan({ ...plan, days: [...plan.days, { id: uid(), name: `Tag ${String.fromCharCode(65 + plan.days.length)}`, weekdays: [], exercises: [] }] })}>
        <Plus className="h-4 w-4" /> Trainingstag hinzufügen
      </Button>
      <div className={cn('sticky bottom-20 z-10 flex gap-2 md:bottom-4', sel && 'hidden')}>
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
          onClose={() => {
            // Neue, noch leere Einheit wieder verwerfen
            if (pickFor.groupId) updDay(pickFor.dayId, (d) => ({ ...d, groups: (d.groups ?? []).filter((g) => g.id !== pickFor.groupId || d.exercises.some((e) => e.groupId === g.id)) }));
            setPickFor(null);
          }}
          onPick={(ex) => {
            const { dayId, groupId } = pickFor;
            updDay(dayId, (d) => {
              if (!groupId) return { ...d, exercises: [...d.exercises, { id: uid(), exerciseId: ex.id, sets: 3, repMax: 10, restSec: 90 }] };
              const g = (d.groups ?? []).find((x) => x.id === groupId);
              const item: PlanExercise = { id: uid(), exerciseId: ex.id, sets: g?.rounds ?? 1, restSec: 0, groupId };
              const last = d.exercises.map((e) => e.groupId).lastIndexOf(groupId);
              const list = [...d.exercises];
              list.splice(last === -1 ? list.length : last + 1, 0, item);
              return { ...d, exercises: list };
            });
            setPickFor(null);
          }}
        />
      )}
    </div>
  );
}

type Block = { kind: 'single'; ex: PlanExercise } | { kind: 'group'; group: PlanGroup; members: PlanExercise[] };

/** Trainingstag als Blöcke: einzelne Übungen und Einheiten (Übungen einer Einheit stehen hintereinander). */
function blocksOf(d: PlanDay): Block[] {
  const groups = new Map((d.groups ?? []).map((g) => [g.id, g]));
  const out: Block[] = [];
  const seen = new Set<string>();
  for (const e of d.exercises) {
    const g = e.groupId ? groups.get(e.groupId) : undefined;
    if (!g) out.push({ kind: 'single', ex: e });
    else if (!seen.has(g.id)) {
      seen.add(g.id);
      out.push({ kind: 'group', group: g, members: d.exercises.filter((x) => x.groupId === g.id) });
    }
  }
  for (const g of groups.values()) if (!seen.has(g.id)) out.push({ kind: 'group', group: g, members: [] });
  return out;
}

function ExerciseHead({ name, muscle, children, lead }: { name: string; muscle?: string; children: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1">
      {lead && <div className="mr-1 shrink-0">{lead}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="text-xs text-muted">{muscle}</div>
      </div>
      {children}
    </div>
  );
}

/** Wiederholungsziel; „ab“ nur, wenn ein Bereich gewünscht ist */
function RepFields({ e, onPatch }: { e: PlanExercise; onPatch: (p: Partial<PlanExercise>) => void }) {
  return (
    <>
      <Field label="Wdh.">{(i) => <NumberInput id={i} value={e.repMax} placeholder="–" onValue={(v) => onPatch({ repMax: v })} />}</Field>
      <Field label="Wdh. ab (opt.)">{(i) => <NumberInput id={i} value={e.repMin} placeholder="–" onValue={(v) => onPatch({ repMin: v })} />}</Field>
    </>
  );
}

export function ExercisePicker({ onClose, onPick }: { onClose: () => void; onPick: (e: Exercise) => void }) {
  const [create, setCreate] = useState(false);
  return (
    <Sheet open onClose={onClose} title="Übung wählen">
      <div className="space-y-2">
        <ExerciseBrowser onPick={onPick} />
        <Button variant="ghost" onClick={() => setCreate(true)}>
          <Plus className="h-4 w-4" /> Eigene Übung anlegen
        </Button>
      </div>
      {create && <ExerciseForm onClose={() => setCreate(false)} onSaved={onPick} />}
    </Sheet>
  );
}
