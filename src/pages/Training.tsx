import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, Copy, Dumbbell, Play, Plus, Star, Trash2, Trophy } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Empty, Field, Input, NumberInput, Select, Sheet, Tabs, Textarea, fmt } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { ExerciseBrowser } from '@/components/ExerciseBrowser';
import { useActiveWorkout, useCardio, usePlans, useWorkouts } from '@/hooks/data';
import { addCardio, deleteCardio, deletePlan, duplicatePlan, saveCustomExercise, savePlan, setPlanStatus, startWorkout, updateCardio, DuplicateError } from '@/data/trainingRepo';
import { WEEKDAY_SHORT, formatDate, isoWeekday, today, uid } from '@/domain/dates';
import { toast, confirmDialog } from '@/stores/ui';
import { firstError } from '@/domain/schemas';
import type { CardioActivity, CardioSession, Exercise, ExerciseKind, Plan } from '@/domain/types';
import { CARDIO_LABELS, completedSets, pace, personalRecords, speedKmh, workoutVolume } from '@/domain/training';
import { EQUIPMENT, GYMS, MUSCLE_GROUPS } from '@/data/exerciseLibrary';
import { PLAN_TEMPLATES, planFromTemplate } from '@/data/planTemplates';
import { useSettings } from '@/hooks/data';
import { sessionKcal } from '@/domain/balance';
import { CLASS_TRAINING, classById } from '@/domain/rpg';
import { formatDuration } from '@/domain/dates';

type Tab = 'plans' | 'history' | 'cardio' | 'exercises' | 'records';

export function Training() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'plans');
  return (
    <div className="space-y-4">
      <PageHeader title="Training" />
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setParams({ tab: t }, { replace: true });
        }}
        items={[
          { value: 'plans', label: 'Pläne' },
          { value: 'history', label: 'Historie' },
          { value: 'cardio', label: 'Ausdauer' },
          { value: 'exercises', label: 'Übungen' },
          { value: 'records', label: 'Rekorde' },
        ]}
      />
      {tab === 'plans' && <Plans />}
      {tab === 'history' && <History />}
      {tab === 'cardio' && <Cardio />}
      {tab === 'exercises' && <ExerciseLibrary />}
      {tab === 'records' && <Records />}
    </div>
  );
}

const SPLIT_LABELS: Record<Plan['split'], string> = {
  fullbody: 'Ganzkörper',
  upper_lower: 'Oberkörper/Unterkörper',
  ppl: 'Push/Pull/Legs',
  custom: 'Benutzerdefiniert',
  strength: 'Krafttraining',
  endurance: 'Ausdauer',
  mobility: 'Mobility',
  bodyweight: 'Körpergewicht',
};
export { SPLIT_LABELS };

function Plans() {
  const plans = usePlans();
  const nav = useNavigate();
  const active = useActiveWorkout();
  const [showArchived, setShowArchived] = useState(false);
  const [params] = useSearchParams();
  const [tplOpen, setTplOpen] = useState(params.get('vorlagen') === '1');
  const visible = plans.filter((p) => (showArchived ? p.status === 'archived' : p.status !== 'archived')).sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : 0));
  const newPlan = async () => {
    const p = await savePlan({ name: 'Neuer Plan', goal: '', split: 'fullbody', status: 'draft', notes: '', days: [{ id: uid(), name: 'Tag A', weekdays: [], exercises: [] }] });
    nav('/training/plan/' + p.id);
  };
  const start = async (p?: Plan, dayId?: string) => {
    try {
      if (active) return nav('/training/workout');
      await startWorkout(p, p?.days.find((d) => d.id === dayId));
      nav('/training/workout');
    } catch (e) {
      toast(firstError(e), 'error');
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={newPlan}>
          <Plus className="h-4 w-4" /> Neuer Plan
        </Button>
        <Button variant="outline" onClick={() => setTplOpen(true)}>
          <Copy className="h-4 w-4" /> Aus Vorlage
        </Button>
        <Button variant="outline" onClick={() => start()}>
          <Play className="h-4 w-4" /> Freies Training
        </Button>
        <Button variant="ghost" onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? 'Aktuelle Pläne' : 'Archiv'}
        </Button>
      </div>
      {tplOpen && (
        <TemplatePicker
          onClose={() => setTplOpen(false)}
          onPick={async (t) => {
            const p = await savePlan(planFromTemplate(t));
            setTplOpen(false);
            toast('Vorlage übernommen – passe den Plan an und aktiviere ihn.', 'success');
            nav('/training/plan/' + p.id);
          }}
        />
      )}
      {!visible.length && <Empty icon={<Dumbbell className="h-8 w-8" />} title={showArchived ? 'Kein archivierter Plan' : 'Noch kein Trainingsplan'} text="Erstelle einen Plan mit Trainingstagen und Übungen." />}
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((p) => (
          <Card key={p.id} data-testid="plan-card">
            <CardTitle action={p.status === 'active' ? <Badge tone="accent">aktiv</Badge> : p.status === 'archived' ? <Badge>archiviert</Badge> : <Badge>Entwurf</Badge>}>
              {p.name}
            </CardTitle>
            <div className="mb-2 text-xs text-muted">
              {SPLIT_LABELS[p.split]} {p.goal && `· ${p.goal}`}
            </div>
            <ul className="space-y-1">
              {p.days.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {d.name} <span className="text-xs text-muted">· {d.exercises.length} Übungen {d.weekdays.length ? '· ' + d.weekdays.map((w) => WEEKDAY_SHORT[w - 1]).join(', ') : ''}</span>
                  </span>
                  {p.status !== 'archived' && d.exercises.length > 0 && (
                    <Button size="sm" variant={d.weekdays.includes(isoWeekday(today())) ? 'primary' : 'secondary'} onClick={() => start(p, d.id)}>
                      <Play className="h-3.5 w-3.5" /> Start
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1">
              <Button size="sm" variant="secondary" onClick={() => nav('/training/plan/' + p.id)}>
                Bearbeiten
              </Button>
              {p.status !== 'active' && p.status !== 'archived' && (
                <Button size="sm" variant="secondary" onClick={() => setPlanStatus(p.id, 'active').then(() => toast('Plan aktiviert', 'success'))}>
                  <Star className="h-3.5 w-3.5" /> Aktivieren
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => duplicatePlan(p.id).then(() => toast('Plan dupliziert', 'success'))}>
                <Copy className="h-3.5 w-3.5" /> Duplizieren
              </Button>
              {p.status !== 'archived' ? (
                <Button size="sm" variant="ghost" onClick={() => setPlanStatus(p.id, 'archived').then(() => toast('Plan archiviert'))}>
                  <Archive className="h-3.5 w-3.5" /> Archivieren
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setPlanStatus(p.id, 'draft')}>
                    Wiederherstellen
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Plan löschen"
                    onClick={async () => (await confirmDialog({ title: 'Plan endgültig löschen?', text: 'Abgeschlossene Workouts bleiben erhalten.', danger: true, confirmLabel: 'Löschen' })) && deletePlan(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TemplatePicker({ onClose, onPick }: { onClose: () => void; onPick: (t: (typeof PLAN_TEMPLATES)[number]) => void }) {
  const settings = useSettings();
  const cls = settings.hero ? CLASS_TRAINING[settings.hero.classId] : undefined;
  const rec = (id: string) => (cls ? cls.templates.indexOf(id) : -1);
  const list = [...PLAN_TEMPLATES].sort(
    (a, b) =>
      (rec(b.id) >= 0 ? 100 - rec(b.id) : 0) - (rec(a.id) >= 0 ? 100 - rec(a.id) : 0) ||
      Number(b.gym === settings.homeGym && !!b.gym) - Number(a.gym === settings.homeGym && !!a.gym),
  );
  return (
    <Sheet open onClose={onClose} title="Planvorlagen">
      <ul className="space-y-2" data-testid="template-list">
        {list.map((t) => (
          <li key={t.id}>
            <button className="w-full rounded-xl border p-3 text-left hover:bg-fg/[0.04]" onClick={() => onPick(t)}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t.name}</span>
                <span className="flex shrink-0 gap-1">
                  {rec(t.id) >= 0 && settings.hero && <Badge tone="info">Empfohlen für {classById(settings.hero.classId)?.name}</Badge>}
                  {t.gym && <Badge tone="accent">{GYMS[t.gym]}</Badge>}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {SPLIT_LABELS[t.split]} · {t.days.length} Tag(e) · {t.sets}×{t.repMin}–{t.repMax}
              </div>
              <p className="mt-1 text-sm text-muted">{t.description}</p>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function History() {
  const workouts = useWorkouts();
  const nav = useNavigate();
  const list = [...workouts].reverse();
  if (!list.length) return <Empty icon={<Dumbbell className="h-8 w-8" />} title="Noch keine Workouts" text="Abgeschlossene Trainingseinheiten erscheinen hier." />;
  return (
    <Card>
      <ul className="divide-y" data-testid="history-list">
        {list.map((w) => (
          <li key={w.id}>
            <button className="flex w-full items-center justify-between gap-2 py-3 text-left" onClick={() => nav('/training/history/' + w.id)}>
              <div className="min-w-0">
                <div className="truncate font-medium">{w.name}</div>
                <div className="text-xs text-muted">
                  {formatDate(w.date)} · {formatDuration(w.durationSec)} · {completedSets(w)} Sätze
                </div>
              </div>
              <div className="text-right text-sm tabular-nums">
                <div>{fmt(workoutVolume(w))} kg</div>
                <div className="text-xs text-muted">~{fmt(sessionKcal(w))} kcal</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Cardio() {
  const sessions = useCardio();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CardioSession | null>(null);
  return (
    <div className="space-y-3">
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Ausdauereinheit erfassen
      </Button>
      <Card>
        {sessions.length ? (
          <ul className="divide-y" data-testid="cardio-list">
            {[...sessions].reverse().map((s) => (
              <li key={s.id}>
                <button className="flex w-full justify-between gap-2 py-3 text-left" onClick={() => setEdit(s)}>
                  <div className="min-w-0">
                    <div className="font-medium">{s.activity === 'custom' ? s.customName || 'Sport' : CARDIO_LABELS[s.activity]}</div>
                    <div className="text-xs text-muted">
                      {formatDate(s.date)} · {s.durationMin} min {s.distanceKm ? `· ${fmt(s.distanceKm, 2)} km · ${pace(s.distanceKm, s.durationMin)} · ${speedKmh(s.distanceKm, s.durationMin)} km/h` : ''} {s.avgHr ? `· Ø ${s.avgHr} bpm` : ''}
                    </div>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    {fmt(sessionKcal(s))} kcal
                    <div className="text-xs text-muted">{s.kcalOverride != null ? 'manuell' : 'geschätzt'}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted">Noch keine Ausdauereinheiten.</p>
        )}
      </Card>
      {open && <CardioForm onClose={() => setOpen(false)} />}
      {edit && <CardioEdit s={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function CardioForm({ onClose }: { onClose: () => void }) {
  const now = new Date();
  const [f, setF] = useState({ date: today(), time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, activity: 'running' as CardioActivity, customName: '', durationMin: 30 as number | undefined, distanceKm: undefined as number | undefined, avgHr: undefined as number | undefined, rpe: 5 as number | undefined, note: '' });
  const save = async (allowDuplicate = false) => {
    try {
      await addCardio(
        { date: f.date, startedAt: new Date(`${f.date}T${f.time}:00`).toISOString(), activity: f.activity, customName: f.customName || undefined, durationMin: f.durationMin ?? 0, distanceKm: f.distanceKm, avgHr: f.avgHr, rpe: f.rpe, note: f.note || undefined },
        { allowDuplicate },
      );
      toast('Ausdauereinheit gespeichert', 'success');
      onClose();
    } catch (e) {
      if (e instanceof DuplicateError) {
        if (await confirmDialog({ title: 'Mögliches Duplikat', text: e.message + '\nTrotzdem speichern?', confirmLabel: 'Trotzdem speichern' })) save(true);
      } else toast(firstError(e), 'error');
    }
  };
  return (
    <Sheet open onClose={onClose} title="Ausdauereinheit" footer={<Button className="flex-1" onClick={() => save()}>Speichern</Button>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sportart" className="col-span-2">
          {(id) => (
            <Select id={id} value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value as CardioActivity })}>
              {Object.entries(CARDIO_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {f.activity === 'custom' && <Field label="Name der Sportart" className="col-span-2">{(id) => <Input id={id} value={f.customName} onChange={(e) => setF({ ...f, customName: e.target.value })} />}</Field>}
        <Field label="Datum">{(id) => <Input id={id} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
        <Field label="Startzeit">{(id) => <Input id={id} type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />}</Field>
        <Field label="Dauer (min)">{(id) => <NumberInput id={id} value={f.durationMin} onValue={(v) => setF({ ...f, durationMin: v })} />}</Field>
        <Field label="Distanz (km, optional)">{(id) => <NumberInput id={id} value={f.distanceKm} onValue={(v) => setF({ ...f, distanceKm: v })} />}</Field>
        <Field label="Ø Herzfrequenz (optional)">{(id) => <NumberInput id={id} value={f.avgHr} onValue={(v) => setF({ ...f, avgHr: v })} />}</Field>
        <Field label="Intensität (RPE 1–10)">{(id) => <NumberInput id={id} value={f.rpe} onValue={(v) => setF({ ...f, rpe: v })} />}</Field>
        <Field label="Notiz" className="col-span-2">{(id) => <Textarea id={id} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}</Field>
      </div>
      <p className="mt-2 text-xs text-muted">Der Energieverbrauch wird über MET-Werte geschätzt (Netto, ohne Ruheumsatz) und ist eine Schätzung.</p>
    </Sheet>
  );
}

function CardioEdit({ s, onClose }: { s: CardioSession; onClose: () => void }) {
  const [kcal, setKcal] = useState<number | undefined>(s.kcalOverride);
  return (
    <Sheet
      open
      onClose={onClose}
      title="Ausdauereinheit"
      footer={
        <>
          <Button variant="danger" onClick={async () => { await deleteCardio(s.id); onClose(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            className="flex-1"
            onClick={async () => {
              try {
                await updateCardio(s.id, { kcalOverride: kcal });
                toast('Gespeichert', 'success');
                onClose();
              } catch (e) {
                toast(firstError(e), 'error');
              }
            }}
          >
            Speichern
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm">Geschätzt: {fmt(s.estimatedKcal)} kcal {s.estimatedKcal === 0 && '(kein Körpergewicht erfasst)'}</p>
      <Field label="Energie manuell (kcal, leer = Schätzung verwenden)">{(id) => <NumberInput id={id} value={kcal} onValue={setKcal} />}</Field>
    </Sheet>
  );
}

function ExerciseLibrary() {
  const nav = useNavigate();
  const [create, setCreate] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => setCreate(true)} aria-label="Eigene Übung">
          <Plus className="h-4 w-4" /> Eigene Übung
        </Button>
      </div>
      <ExerciseBrowser onPick={(e) => nav('/training/exercise/' + e.id)} />
      {create && <ExerciseForm onClose={() => setCreate(false)} />}
    </div>
  );
}

export function ExerciseForm({ onClose, onSaved }: { onClose: () => void; onSaved?: (e: Exercise) => void }) {
  const [f, setF] = useState({ name: '', primaryMuscle: 'Brust', secondary: [] as string[], equipment: 'Kurzhantel', kind: 'strength' as ExerciseKind, description: '' });
  return (
    <Sheet
      open
      onClose={onClose}
      title="Eigene Übung"
      footer={
        <Button
          className="flex-1"
          onClick={async () => {
            try {
              const e = await saveCustomExercise({ name: f.name, primaryMuscle: f.primaryMuscle, secondaryMuscles: f.secondary, equipment: f.equipment, kind: f.kind, description: f.description, alternatives: [] });
              toast('Übung gespeichert', 'success');
              onSaved?.(e);
              onClose();
            } catch (e) {
              toast(firstError(e), 'error');
            }
          }}
        >
          Speichern
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Muskelgruppe">
            {(id) => (
              <Select id={id} value={f.primaryMuscle} onChange={(e) => setF({ ...f, primaryMuscle: e.target.value })}>
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Equipment">
            {(id) => (
              <Select id={id} value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value })}>
                {EQUIPMENT.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Art">
            {(id) => (
              <Select id={id} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ExerciseKind })}>
                <option value="strength">Kraft</option>
                <option value="bodyweight">Körpergewicht</option>
                <option value="mobility">Mobility</option>
                <option value="cardio">Ausdauer</option>
              </Select>
            )}
          </Field>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-muted">Sekundäre Muskelgruppen</div>
          <div className="flex flex-wrap gap-1">
            {MUSCLE_GROUPS.filter((m) => m !== f.primaryMuscle).map((m) => (
              <button key={m} type="button" aria-pressed={f.secondary.includes(m)} onClick={() => setF({ ...f, secondary: f.secondary.includes(m) ? f.secondary.filter((x) => x !== m) : [...f.secondary, m] })} className={`h-8 rounded-full border px-2 text-xs ${f.secondary.includes(m) ? 'border-accent bg-accent/10 text-accent' : 'text-muted'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <Field label="Beschreibung">{(id) => <Textarea id={id} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
      </div>
    </Sheet>
  );
}

function Records() {
  const workouts = useWorkouts();
  const nav = useNavigate();
  const prs = useMemo(() => {
    const all = personalRecords(workouts);
    const by = new Map<string, typeof all>();
    for (const p of all) by.set(p.exerciseId, [...(by.get(p.exerciseId) ?? []), p]);
    return [...by.entries()];
  }, [workouts]);
  if (!prs.length) return <Empty icon={<Trophy className="h-8 w-8" />} title="Noch keine Bestleistungen" text="Bestleistungen werden aus abgeschlossenen Sätzen ermittelt." />;
  const label = { weight: 'Höchstes Gewicht', e1rm: 'Geschätztes 1RM', reps: 'Meiste Wdh.', volume: 'Volumen/Einheit' };
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {prs.map(([id, list]) => (
        <Card key={id}>
          <button className="w-full text-left" onClick={() => nav('/training/exercise/' + id)}>
            <CardTitle>{list[0]!.name}</CardTitle>
            <ul className="space-y-1 text-sm">
              {list.map((p) => (
                <li key={p.kind} className="flex justify-between gap-2">
                  <span className="text-muted">{label[p.kind]}</span>
                  <span className="tabular-nums">
                    {p.kind === 'reps' ? p.value : `${fmt(p.value, 1)} kg`} <span className="text-xs text-muted">({formatDate(p.date, { day: '2-digit', month: '2-digit' })})</span>
                  </span>
                </li>
              ))}
            </ul>
          </button>
        </Card>
      ))}
    </div>
  );
}
