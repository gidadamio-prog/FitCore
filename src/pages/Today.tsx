import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Droplets, Dumbbell, Plus, Scale, Sparkles, ChevronRight, Moon } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Field, NumberInput, Progress, Ring, Sheet, Stat, fmt } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { useActiveWorkout, useCardio, useDaySummary, useGoals, useMeasurements, usePlans, useProfile, useSettings, useWorkouts, useAllEntries } from '@/hooks/data';
import { addDays, formatLongDate, isoWeekday, startOfWeek, today } from '@/domain/dates';
import { dailySeries, emaTrend, windowTrend } from '@/domain/body';
import { addWater } from '@/data/nutritionRepo';
import { saveMeasurement } from '@/data/bodyRepo';
import { startWorkout } from '@/data/trainingRepo';
import { toast } from '@/stores/ui';
import { firstError } from '@/domain/schemas';
import { completedSets, workoutVolume } from '@/domain/training';
import { calorieGoalRate, dailyNutrition } from '@/domain/stats';
import { coachInsights, classifyDay, dayRecommendations, DAY_TYPE_LABELS } from '@/domain/coach';
import { useLiveQuery } from 'dexie-react-hooks';
import { InstallPrompt } from '@/components/InstallPrompt';
import { useGame } from '@/hooks/game';
import { QuestList, RankHeader, StreakChips } from './Achievements';
import { db } from '@/data/db';
import type { RecoveryLog } from '@/domain/types';

export function Today() {
  const date = today();
  const nav = useNavigate();
  const profile = useProfile();
  const s = useDaySummary(date);
  const ms = useMeasurements();
  const plans = usePlans();
  const workouts = useWorkouts();
  const cardio = useCardio();
  const goals = useGoals();
  const entries = useAllEntries();
  const settings = useSettings();
  const active = useActiveWorkout();
  const [weightOpen, setWeightOpen] = useState(false);
  const game = useGame();
  const plan = plans.find((p) => p.status === 'active');
  const todaysDays = plan?.days.filter((d) => d.weekdays.includes(isoWeekday(date))) ?? [];
  const lastWorkout = workouts[workouts.length - 1];

  const weight = useMemo(() => {
    const pts = dailySeries(ms);
    const trend = emaTrend(pts);
    const lastRaw = [...ms].filter((m) => m.weightKg != null).sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt)).pop();
    return { last: lastRaw ? { date: lastRaw.date, value: lastRaw.weightKg! } : undefined, trend: trend[trend.length - 1], w7: windowTrend(pts, 7, date) };
  }, [ms, date]);

  const week = useMemo(() => {
    const from = startOfWeek(date);
    const days = dailyNutrition(entries, goals, from, date);
    const rate = calorieGoalRate(days);
    const done = workouts.filter((w) => w.date >= from && w.date <= date).length + cardio.filter((c) => c.date >= from && c.date <= date).length;
    const planned = plan ? new Set(plan.days.flatMap((d) => d.weekdays)).size : profile?.trainingDaysPerWeek ?? 0;
    return { rate, done, planned };
  }, [entries, goals, workouts, cardio, plan, profile, date]);

  const insights = useMemo(
    () => (profile ? coachInsights({ asOf: date, measurements: ms, entries, goals, workouts, cardio, activePlan: plan, sex: profile.sex, deficitAllowed: profile.specialSituation === 'none' }) : []),
    [profile, date, ms, entries, goals, workouts, cardio, plan],
  );
  const dayType = classifyDay(date, workouts, cardio, plan);
  const trainingMin = (s?.workouts.reduce((a, w) => a + w.durationSec / 60, 0) ?? 0) + (s?.cardio.reduce((a, c) => a + c.durationMin, 0) ?? 0);
  const recs = dayRecommendations(dayType, weight.last?.value ?? null, s?.goal, trainingMin);

  const start = async (dayId?: string) => {
    try {
      if (active) return nav('/training/workout');
      const day = plan?.days.find((d) => d.id === dayId);
      await startWorkout(day ? plan : undefined, day);
      nav('/training/workout');
    } catch (e) {
      toast(firstError(e), 'error');
    }
  };

  if (!s || !profile) return null;
  const g = s.goal;
  const t = s.sum.totals;
  return (
    <div className="space-y-4">
      <PageHeader title={`Hallo ${profile.name}`} subtitle={formatLongDate(date)} />
      <InstallPrompt />
      {game && (
        <Card className="border-gold/25" data-testid="game-card">
          <button className="block w-full text-left" onClick={() => nav('/erfolge')} aria-label="Zur Ruhmeshalle">
            <RankHeader game={game} compact />
          </button>
          <div className="mt-3">
            <StreakChips game={game} />
          </div>
          <button className="mt-3 block w-full rounded-xl bg-fg/[0.04] p-3 text-left" onClick={() => nav(settings.hero ? '/erfolge?tab=feldzug' : '/erfolge?tab=held')} data-testid="today-hero">
            {settings.hero ? (
              <>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold">
                    {settings.hero.name} · Stufe {game.level.level}
                  </span>
                  <span className="shrink-0 text-xs text-muted">Kampfwert {fmt(game.battle.score)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="truncate">
                    Gegner: {game.campaign.current.boss.name} ({game.campaign.current.boss.province})
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {fmt(game.campaign.current.remaining)} LP
                  </span>
                </div>
                <Progress className="mt-1" value={game.campaign.current.remaining} max={game.campaign.current.boss.hp} color="danger" label="Lebenspunkte des Gegners" />
              </>
            ) : (
              <span className="text-sm font-medium text-gold">Erschaffe deinen Helden und zieh gegen die Bosse des Reiches →</span>
            )}
          </button>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">
              Feldzüge dieser Woche · {game.quests.filter((q) => q.done).length}/{game.quests.length}
            </summary>
            <div className="mt-2">
              <QuestList quests={game.quests} />
            </div>
          </details>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {g ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <Ring value={t.kcal} max={g.calorieTarget + s.credit.creditedKcal} size={168}>
                <div className="text-3xl font-bold tabular-nums" data-testid="remaining-kcal">
                  {fmt(s.budget!.remaining)}
                </div>
                <div className="text-xs text-muted">{s.budget!.remaining >= 0 ? 'kcal übrig' : 'kcal über Budget'}</div>
              </Ring>
              <div className="grid w-full flex-1 grid-cols-3 gap-3">
                <Stat label="Ziel" value={<span data-testid="target-kcal">{fmt(g.calorieTarget)}</span>} unit="kcal" />
                <Stat label="Gegessen" value={<span data-testid="eaten-kcal">{fmt(t.kcal)}</span>} unit="kcal" />
                <Stat label="Training" value={<span data-testid="credited-kcal">+{fmt(s.credit.creditedKcal)}</span>} unit="kcal" sub={s.credit.rawKcal ? `geschätzt · ${profile.trainingCreditPct} % von ${fmt(s.credit.creditableKcal)}` : 'kein Training'} />
                <MacroBar label="Protein" value={t.protein} target={g.proteinG} color="protein" />
                <MacroBar label="Kohlenhydrate" value={t.carbs} target={g.carbsG} color="carbs" />
                <MacroBar label="Fett" value={t.fat} target={g.fatG} color="fat" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Für heute ist noch kein Ziel hinterlegt.</p>
          )}
          {s.sum.unknown.kcal > 0 && <p className="mt-2 text-xs text-warn">{s.sum.unknown.kcal} Einträge ohne Kalorienangabe – Summe unvollständig.</p>}
        </Card>
        <Card>
          <CardTitle>Schnellaktionen</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="h-14 flex-col gap-1 text-xs" onClick={() => nav('/nutrition?add=1')}>
              <Plus className="h-5 w-5" /> Lebensmittel
            </Button>
            <Button variant="secondary" className="h-14 flex-col gap-1 text-xs" onClick={() => nav('/nutrition?copy=1')}>
              <Copy className="h-5 w-5" /> Mahlzeit kopieren
            </Button>
            <Button variant="secondary" className="h-14 flex-col gap-1 text-xs" onClick={() => start(todaysDays[0]?.id)}>
              <Dumbbell className="h-5 w-5" /> Training starten
            </Button>
            <Button variant="secondary" className="h-14 flex-col gap-1 text-xs" onClick={() => setWeightOpen(true)}>
              <Scale className="h-5 w-5" /> Gewicht
            </Button>
            <Button
              variant="secondary"
              className="col-span-2 h-12 text-xs"
              onClick={async () => {
                await addWater(date, 250);
                toast('+250 ml Wasser', 'success');
              }}
            >
              <Droplets className="h-5 w-5" /> Wasser +250 ml · {fmt(s.waterMl / 1000, 2)} / {fmt(settings.waterGoalMl / 1000, 1)} l
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardTitle action={<Badge>{DAY_TYPE_LABELS[dayType]}</Badge>}>Geplantes Training</CardTitle>
          {plan ? (
            todaysDays.length ? (
              <ul className="space-y-2">
                {todaysDays.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{d.name}</div>
                      <div className="text-xs text-muted">
                        {plan.name} · {d.exercises.length} Übungen
                      </div>
                    </div>
                    <Button size="sm" onClick={() => start(d.id)}>
                      Starten
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                Heute kein Trainingstag in „{plan.name}“.{' '}
                <button className="text-accent underline" onClick={() => nav('/training')}>
                  Plan ansehen
                </button>
              </p>
            )
          ) : (
            <p className="text-sm text-muted">
              Kein aktiver Plan.{' '}
              <button className="text-accent underline" onClick={() => nav('/training')}>
                Plan erstellen oder aktivieren
              </button>
            </p>
          )}
        </Card>
        <Card>
          <CardTitle>Letzte Trainingsleistung</CardTitle>
          {lastWorkout ? (
            <button className="w-full text-left" onClick={() => nav('/training/history/' + lastWorkout.id)}>
              <div className="font-medium">{lastWorkout.name}</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Stat label="Datum" value={new Date(lastWorkout.startedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} />
                <Stat label="Sätze" value={completedSets(lastWorkout)} />
                <Stat label="Volumen" value={fmt(workoutVolume(lastWorkout))} unit="kg" />
              </div>
            </button>
          ) : (
            <p className="text-sm text-muted">Noch kein Workout abgeschlossen.</p>
          )}
        </Card>
        <Card>
          <CardTitle action={<button className="text-xs text-accent" onClick={() => nav('/body')}>Details</button>}>Gewichtstrend</CardTitle>
          {weight.last ? (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Letzte Messung" value={fmt(weight.last.value, 1)} unit="kg" />
              <Stat label="Trend (EMA)" value={fmt(weight.trend?.value, 1)} unit="kg" />
              <Stat label="7-Tage-Trend" value={weight.w7.kgPerWeek == null ? '–' : `${weight.w7.kgPerWeek > 0 ? '+' : ''}${fmt(weight.w7.kgPerWeek, 2)}`} unit={weight.w7.kgPerWeek == null ? undefined : 'kg/W'} sub={weight.w7.n < 2 ? 'zu wenig Daten' : `${weight.w7.n} Messungen`} />
            </div>
          ) : (
            <p className="text-sm text-muted">Noch kein Gewicht erfasst.</p>
          )}
        </Card>
        <Card>
          <CardTitle>Wochenfortschritt</CardTitle>
          <div className="space-y-3 text-sm">
            <div>
              <div className="mb-1 flex justify-between">
                <span className="text-muted">Kalorienziel getroffen (±10 %)</span>
                <span className="tabular-nums">
                  {week.rate.hitDays}/{week.rate.evaluableDays} Tage
                </span>
              </div>
              <Progress value={week.rate.hitDays} max={Math.max(1, week.rate.evaluableDays)} label="Kalorienziel Woche" />
              {week.rate.missingDates.length > 0 && <div className="mt-1 text-xs text-muted">{week.rate.missingDates.length} Tag(e) ohne Einträge</div>}
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span className="text-muted">Trainingseinheiten</span>
                <span className="tabular-nums">
                  {week.done}/{week.planned || '–'}
                </span>
              </div>
              <Progress value={week.done} max={Math.max(1, week.planned)} label="Training Woche" />
            </div>
          </div>
        </Card>
        <Card>
          <CardTitle action={<button className="flex items-center text-xs text-accent" onClick={() => nav('/coach')}>Alle <ChevronRight className="h-3 w-3" /></button>}>
            <span className="flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-accent" /> Coach
            </span>
          </CardTitle>
          <ul className="space-y-2 text-sm">
            {insights.slice(0, 3).map((i) => (
              <li key={i.id}>
                <div className="font-medium">{i.title}</div>
                <div className="text-xs text-muted">{i.message}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Ernährung heute · {DAY_TYPE_LABELS[dayType]}</CardTitle>
          <ul className="space-y-2 text-sm">
            {recs.slice(0, 4).map((r) => (
              <li key={r.topic}>
                <span className="font-medium">{r.topic}: </span>
                <span className="text-muted">{r.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">Allgemeine Richtwerte – sie ändern deine Ziele nicht automatisch.</p>
        </Card>
        <RecoveryCard date={date} />
      </div>
      <WeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} last={weight.last?.value} />
    </div>
  );
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: 'protein' | 'carbs' | 'fat' }) {
  return (
    <div className="min-w-0">
      <div className="flex justify-between text-xs">
        <span className="truncate text-muted">{label}</span>
      </div>
      <div className="text-sm font-semibold tabular-nums" data-testid={`macro-${color}`}>
        {fmt(value)}
        <span className="text-xs font-normal text-muted">/{target} g</span>
      </div>
      <Progress value={value} max={target} color={color} label={label} />
    </div>
  );
}

export function WeightSheet({ open, onClose, last }: { open: boolean; onClose: () => void; last?: number }) {
  const [v, setV] = useState<number | undefined>(undefined);
  const [err, setErr] = useState<string>();
  const save = async () => {
    try {
      await saveMeasurement({ date: today(), weightKg: v });
      toast('Gewicht gespeichert', 'success');
      setV(undefined);
      setErr(undefined);
      onClose();
    } catch (e) {
      setErr(firstError(e));
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Körpergewicht erfassen" footer={<Button className="flex-1" onClick={save}>Speichern</Button>}>
      <Field label="Gewicht heute (kg)" error={err} hint={last ? `Letzte Messung: ${fmt(last, 1)} kg` : undefined}>
        {(id) => <NumberInput id={id} value={v} onValue={setV} onKeyDown={(e) => e.key === 'Enter' && save()} />}
      </Field>
    </Sheet>
  );
}

function RecoveryCard({ date }: { date: string }) {
  const log = useLiveQuery(() => db.recovery.get(date), [date]);
  const yesterday = useLiveQuery(() => db.recovery.get(addDays(date, -1)), [date]);
  const update = async (patch: Partial<RecoveryLog>) => {
    const cur = (await db.recovery.get(date)) ?? { id: date, date };
    await db.recovery.put({ ...cur, ...patch });
  };
  const scale = (k: 'sleepQuality' | 'soreness' | 'energy', label: string) => (
    <div>
      <div className="mb-1 text-xs text-muted">{label}</div>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={log?.[k] === n} onClick={() => update({ [k]: n })} className={`h-9 flex-1 rounded-lg text-sm ${log?.[k] === n ? 'bg-accent text-accent-fg' : 'bg-fg/[0.06]'}`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <Card>
      <CardTitle>
        <span className="flex items-center gap-1">
          <Moon className="h-4 w-4" /> Regeneration
        </span>
      </CardTitle>
      <div className="space-y-3">
        <Field label="Schlafdauer (h)" hint={yesterday?.sleepHours ? `Gestern: ${yesterday.sleepHours} h` : undefined}>
          {(id) => <NumberInput id={id} value={log?.sleepHours} onValue={(v) => (v == null || (v >= 0 && v <= 24)) && update({ sleepHours: v })} />}
        </Field>
        {scale('sleepQuality', 'Schlafqualität (1 = schlecht, 5 = sehr gut)')}
        {scale('soreness', 'Muskelkater (1 = keiner, 5 = stark)')}
        {scale('energy', 'Energielevel (1 = niedrig, 5 = hoch)')}
      </div>
    </Card>
  );
}
