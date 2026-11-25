import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Droplets, Dumbbell, Plus, Scale, Sparkles, ChevronRight, Moon, CloudUpload, Footprints, Info, CalendarDays, Swords, Crown } from 'lucide-react';
import { Button, Card, CardTitle, Field, NumberInput, Progress, Sheet, Stat, fmt } from '@/components/ui';
import { HeroCamp, SceneCard, SceneValue, StationTile, sceneUrl } from '@/components/lager/Lager';
import { ROMAN } from '@/domain/lager';
import type { GameState } from '@/domain/gamification';
import type { StationId, StationState } from '@/domain/lager';
import { BossStage } from '@/components/rpg/BossStage';
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
import { backupDue, saveBackupToCloud } from '@/data/backup';
import { setSetting } from '@/data/profileRepo';
import { useGame } from '@/hooks/game';
import { StreakChips } from './Achievements';
import { SickBanner, SickButton } from '@/components/SickDay';
import { DailyQuestBanner, QuestBoard } from '@/components/QuestBoard';
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
  const lager = game?.lager;
  // geöffnete Station (nur eine zugleich); scrollt sie ins Bild
  const [open, setOpen] = useState<StationId | null>(null);
  const [levelInfo, setLevelInfo] = useState(false);
  const toggle = (id: StationId | null) => {
    setOpen(id);
    if (id) requestAnimationFrame(() => document.querySelector(`[data-testid="${id === 'pfad' ? 'steps-card' : `station-${id}`}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
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
      {backupDue(settings.lastBackupAt, settings.backupSnoozeUntil, profile.createdAt) && (
        <Card className="flex items-center gap-3 border-warn/40" data-testid="backup-reminder">
          <CloudUpload className="h-6 w-6 shrink-0 text-warn" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{settings.lastBackupAt ? 'Zeit für ein Backup' : 'Noch kein Backup'}</div>
            <div className="text-xs text-muted">Deine Daten liegen nur auf diesem Handy. Einmal in OneDrive sichern dauert 10 Sekunden.</div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  const r = await saveBackupToCloud();
                  if (r !== 'cancelled') toast(r === 'shared' ? 'Backup übergeben – in OneDrive „Hochladen“ wählen' : 'Backup heruntergeladen', 'success');
                }}
              >
                Jetzt sichern
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void setSetting('backupSnoozeUntil', addDays(date, 2))}>
                Später
              </Button>
            </div>
          </div>
        </Card>
      )}
      <SickBanner />
      {game && (
        <Card className="overflow-hidden border-gold/25 p-2" data-testid="game-card">
          <HeroCamp game={game} onHero={() => nav('/held?tab=held')} />
          <div className="px-2 pb-2 pt-2">
            <div className="flex w-full items-center gap-2 text-xs">
              <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => nav('/stats?section=ruhm')} aria-label="Rang und Ruhm ansehen">
                <span className="font-brand text-sm font-bold text-gold" data-testid="rank-name">
                  {game.rank.rank.name}
                </span>
                <span className="text-muted">
                  Rang {game.rank.rank.level} · <span data-testid="xp-total">{fmt(game.xp)}</span> EP
                </span>
                <span className="ml-auto min-w-0 flex-1">
                  <Progress value={game.rank.progress * 100} max={100} label="Fortschritt zum nächsten Rang" />
                </span>
              </button>
              <button className="shrink-0 rounded-full p-1 text-muted hover:text-fg" onClick={() => setLevelInfo(true)} aria-label="Was ist Stufe, was ist Rang?" data-testid="level-rank-info">
                <Info className="h-4 w-4" />
              </button>
            </div>
            {levelInfo && <LevelRankSheet game={game} onClose={() => setLevelInfo(false)} />}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StreakChips game={game} compact />
              <SickButton />
            </div>
          </div>
        </Card>
      )}
      {game && (game.dailyQuest || game.quests.length > 0 || game.questOffers.length > 0) && (
        <Card data-testid="quest-card">
          {game.dailyQuest && <DailyQuestBanner q={game.dailyQuest} />}
          <details className={game.dailyQuest ? 'mt-3' : undefined}>
            <summary className="cursor-pointer text-sm font-medium">
              {!game.questsPicked && game.questOffers.length > 0 ? (
                <span className="text-gold">Aufträge der Woche wählen (3 aus {game.questOffers.length})</span>
              ) : (
                <>
                  Aufträge dieser Woche · {game.quests.filter((q) => q.done).length}/{game.quests.length}
                </>
              )}
            </summary>
            <div className="mt-2">
              <QuestBoard game={game} />
            </div>
          </details>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="stations">
        {lager && game && (
          <div className="col-span-2 md:col-span-3" data-testid="station-kartentisch">
            <BossStage
              compact
              game={game}
              bg={sceneUrl('kartentisch', lager.kartentisch.tier)}
              kicker="Kartentisch"
              badge={
                <span className="rounded-full bg-black/55 px-1.5 text-[10px] font-semibold text-gold" title={`Ausbau ${ROMAN[lager.kartentisch.tier]} · ${lager.kartentisch.name}`}>
                  {ROMAN[lager.kartentisch.tier]}
                </span>
              }
              onOpen={() => nav(settings.hero ? '/karte' : '/held?tab=held')}
              cta={settings.hero ? `Zur Weltkarte · ${game.world.ap} AP` : 'Helden erschaffen und losziehen'}
            />
          </div>
        )}
        {lager &&
          (open === 'proviant' ? (
          <SceneCard
            st={lager.proviant}
            onClose={() => toggle(null)}
            className="col-span-2 md:col-span-3"
            onScene={() => nav('/nutrition?add=1')}
            sceneLabel="Proviant – Essen eintragen"
            overlay={
              g ? (
                <SceneValue value={fmt(s.budget!.remaining)} unit={s.budget!.remaining >= 0 ? 'kcal übrig' : 'kcal drüber'} sub={`${fmt(t.kcal)} von ${fmt(g.calorieTarget + s.credit.creditedKcal)} kcal`} testId="remaining-kcal" />
              ) : (
                <div className="text-xs text-white/80">Noch kein Ziel hinterlegt</div>
              )
            }
          >
            {g ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Ziel" value={<span data-testid="target-kcal">{fmt(g.calorieTarget)}</span>} unit="kcal" />
                  <Stat label="Gegessen" value={<span data-testid="eaten-kcal">{fmt(t.kcal)}</span>} unit="kcal" />
                  <Stat label="Training" value={<span data-testid="credited-kcal">+{fmt(s.credit.creditedKcal)}</span>} unit="kcal" sub={s.credit.rawKcal ? `geschätzt · ${profile.trainingCreditPct} % von ${fmt(s.credit.creditableKcal)}` : 'kein Training'} />
                  <MacroBar label="Protein" value={t.protein} target={s.macros?.proteinG ?? g.proteinG} extra={s.macros?.extra.proteinG} color="protein" />
                  <MacroBar label="Kohlenhydrate" value={t.carbs} target={s.macros?.carbsG ?? g.carbsG} extra={s.macros?.extra.carbsG} color="carbs" />
                  <MacroBar label="Fett" value={t.fat} target={s.macros?.fatG ?? g.fatG} extra={s.macros?.extra.fatG} color="fat" />
                </div>
                {s.credit.rawKcal > 0 && profile.trainingCreditPct === 0 && (
                  <p className="mt-2 text-xs text-muted" data-testid="credit-hint">
                    Du hast heute trainiert, aber Trainingsenergie wird nicht angerechnet – deine Ziele bleiben daher gleich.{' '}
                    <button className="text-accent underline" onClick={() => nav('/settings?tab=energy')}>
                      Anrechnung einstellen
                    </button>
                  </p>
                )}
                {s.sum.unknown.kcal > 0 && <p className="mt-2 text-xs text-warn">{s.sum.unknown.kcal} Einträge ohne Kalorienangabe – Summe unvollständig.</p>}
                <div className="mt-3 text-xs text-muted">
                  Kalorienziel diese Woche: {week.rate.hitDays}/{week.rate.evaluableDays} Tage{week.rate.missingDates.length > 0 && ` · ${week.rate.missingDates.length} Tag(e) ohne Einträge`}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Für heute ist noch kein Ziel hinterlegt.</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={() => nav('/nutrition?add=1')}>
                <Plus className="h-4 w-4" /> Lebensmittel
              </Button>
              <Button variant="secondary" onClick={() => nav('/nutrition?copy=1')}>
                <Copy className="h-4 w-4" /> Mahlzeit kopieren
              </Button>
              <Button variant="secondary" className="col-span-2" onClick={() => nav('/nutrition?tab=plan')} data-testid="proviant-plan">
                <CalendarDays className="h-4 w-4" /> Wochenplan
              </Button>
            </div>
          </SceneCard>
          ) : (
            <StationTile
              st={lager.proviant}
              onOpen={() => toggle('proviant')}
              value={g ? <span data-testid="remaining-kcal">{fmt(s.budget!.remaining)}</span> : '–'}
              sub={g ? (s.budget!.remaining >= 0 ? 'kcal übrig' : 'kcal drüber') : 'kein Ziel'}
              action={
                <Button size="sm" className="w-full" onClick={() => nav('/nutrition?add=1')}>
                  <Plus className="h-4 w-4" /> Lebensmittel
                </Button>
              }
            />
          ))}

        {lager &&
          (open === 'training' ? (
          <SceneCard
            st={lager.training}
            onClose={() => toggle(null)}
            className="col-span-2 md:col-span-3"
            overlay={
              <div className="text-white">
                <div className="text-xs text-white/75">{DAY_TYPE_LABELS[dayType]}</div>
                <div className="text-base font-semibold leading-tight drop-shadow">{active ? 'Training läuft' : todaysDays[0]?.name ?? (plan ? 'Kein Plantag' : 'Freies Training')}</div>
                <div className="text-xs text-white/75">
                  {week.done}/{week.planned || '–'} Einheiten diese Woche
                </div>
              </div>
            }
          >
            {settings.sickDays?.includes(date) && <p className="mb-2 text-xs text-sky-300" data-testid="sick-training">Krankentag – Training ist heute keine Pflicht.</p>}
            <Button className="w-full" onClick={() => start(todaysDays[0]?.id)}>
              <Dumbbell className="h-4 w-4" /> Training starten
            </Button>
            {plan ? (
              todaysDays.length ? (
                <ul className="mt-3 space-y-2">
                  {todaysDays.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{d.name}</div>
                        <div className="text-xs text-muted">
                          {plan.name} · {d.exercises.length} Übungen
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => start(d.id)}>
                        Starten
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  Heute kein Trainingstag in „{plan.name}“.{' '}
                  <button className="text-accent underline" onClick={() => nav('/training')}>
                    Plan ansehen
                  </button>
                </p>
              )
            ) : (
              <p className="mt-2 text-xs text-muted">
                Kein aktiver Plan.{' '}
                <button className="text-accent underline" onClick={() => nav('/training')}>
                  Plan erstellen oder aktivieren
                </button>
              </p>
            )}
            {lastWorkout && (
              <button className="mt-3 w-full rounded-xl bg-fg/[0.04] p-3 text-left" onClick={() => nav('/training/history/' + lastWorkout.id)}>
                <div className="text-xs text-muted">Letzte Einheit</div>
                <div className="font-medium">{lastWorkout.name}</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Stat label="Datum" value={new Date(lastWorkout.startedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} />
                  <Stat label="Sätze" value={completedSets(lastWorkout)} />
                  <Stat label="Volumen" value={fmt(workoutVolume(lastWorkout))} unit="kg" />
                </div>
              </button>
            )}
          </SceneCard>
          ) : (
            <StationTile
              st={lager.training}
              onOpen={() => toggle('training')}
              value={`${week.done}/${week.planned || '–'}`}
              sub={settings.sickDays?.includes(date) ? 'Krankentag' : active ? 'Training läuft' : todaysDays[0]?.name ?? DAY_TYPE_LABELS[dayType]}
              action={
                <Button size="sm" variant="secondary" className="w-full" onClick={() => start(todaysDays[0]?.id)}>
                  <Dumbbell className="h-4 w-4" /> Training starten
                </Button>
              }
            />
          ))}

        {lager && <StepsCard date={date} goal={date === today() && game ? game.stepGoalToday : settings.stepGoal} bonus={date === today() && game && game.stepGoalToday < settings.stepGoal ? settings.stepGoal - game.stepGoalToday : 0} st={lager.pfad} open={open === 'pfad'} onToggle={(o) => toggle(o ? 'pfad' : null)} />}

        {lager &&
          (open === 'brunnen' ? (
          <SceneCard
            st={lager.brunnen}
            onClose={() => toggle(null)}
            className="col-span-2 md:col-span-3"
            overlay={<SceneValue value={fmt(s.waterMl / 1000, 2)} unit={`von ${fmt(settings.waterGoalMl / 1000, 1)} l`} sub={s.waterMl >= settings.waterGoalMl ? '✓ Trinkziel erreicht' : `noch ${fmt(Math.max(0, settings.waterGoalMl - s.waterMl) / 1000, 2)} l`} testId="water-today" />}
          >
            <Progress value={s.waterMl} max={settings.waterGoalMl} label="Trinkziel" />
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={async () => {
                await addWater(date, 250);
                toast('+250 ml Wasser', 'success');
              }}
            >
              <Droplets className="h-4 w-4" /> Wasser +250 ml
            </Button>
          </SceneCard>
          ) : (
            <StationTile
              st={lager.brunnen}
              onOpen={() => toggle('brunnen')}
              value={
                <>
                  <span data-testid="water-today">{fmt(s.waterMl / 1000, 2)}</span> l
                </>
              }
              sub={s.waterMl >= settings.waterGoalMl ? '✓ Trinkziel erreicht' : `von ${fmt(settings.waterGoalMl / 1000, 1)} l`}
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  aria-label="Wasser +250 ml"
                  onClick={async () => {
                    await addWater(date, 250);
                    toast('+250 ml Wasser', 'success');
                  }}
                >
                  <Droplets className="h-4 w-4" /> +250 ml
                </Button>
              }
            />
          ))}

        {lager &&
          (open === 'heiler' ? (
          <SceneCard
            st={lager.heiler}
            onClose={() => toggle(null)}
            className="col-span-2 md:col-span-3"
            overlay={
              weight.last ? (
                <SceneValue value={fmt(weight.last.value, 1)} unit="kg" sub={weight.w7.kgPerWeek == null ? 'Trend: zu wenig Daten' : `${weight.w7.kgPerWeek > 0 ? '+' : ''}${fmt(weight.w7.kgPerWeek, 2)} kg/Woche`} />
              ) : (
                <div className="text-xs text-white/80">Noch kein Gewicht erfasst</div>
              )
            }
          >
            {weight.last && (
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Letzte Messung" value={fmt(weight.last.value, 1)} unit="kg" />
                <Stat label="Trend (EMA)" value={fmt(weight.trend?.value, 1)} unit="kg" />
                <Stat label="7-Tage-Trend" value={weight.w7.kgPerWeek == null ? '–' : `${weight.w7.kgPerWeek > 0 ? '+' : ''}${fmt(weight.w7.kgPerWeek, 2)}`} unit={weight.w7.kgPerWeek == null ? undefined : 'kg/W'} sub={weight.w7.n < 2 ? 'zu wenig Daten' : `${weight.w7.n} Messungen`} />
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setWeightOpen(true)}>
                <Scale className="h-4 w-4" /> Gewicht
              </Button>
              <Button variant="ghost" onClick={() => nav('/body')}>
                Verlauf <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <details className="mt-3">
              <summary className="flex cursor-pointer items-center gap-1 text-sm font-medium">
                <Moon className="h-4 w-4" /> Schlaf und Erholung
              </summary>
              <div className="mt-3">
                <RecoveryFields date={date} />
              </div>
            </details>
          </SceneCard>
          ) : (
            <StationTile
              st={lager.heiler}
              onOpen={() => toggle('heiler')}
              value={weight.last ? `${fmt(weight.last.value, 1)} kg` : '–'}
              sub={weight.w7.kgPerWeek == null ? 'Trend: zu wenig Daten' : `${weight.w7.kgPerWeek > 0 ? '+' : ''}${fmt(weight.w7.kgPerWeek, 2)} kg/Woche`}
              action={
                <Button size="sm" variant="secondary" className="w-full" onClick={() => setWeightOpen(true)}>
                  <Scale className="h-4 w-4" /> Gewicht
                </Button>
              }
            />
          ))}
      </div>

      <Card data-testid="coach-card">
        <CardTitle action={<button className="flex items-center text-xs text-accent" onClick={() => nav('/coach')}>Alle <ChevronRight className="h-3 w-3" /></button>}>
          <span className="flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-accent" /> Rat des Lagers
          </span>
        </CardTitle>
        {insights[0] && (
          <div className="text-sm">
            <div className="font-medium">{insights[0].title}</div>
            <div className="text-xs text-muted">{insights[0].message}</div>
          </div>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-muted">Mehr Hinweise · Ernährung heute ({DAY_TYPE_LABELS[dayType]})</summary>
          <ul className="mt-2 space-y-2 text-sm">
            {insights.slice(1, 3).map((i) => (
              <li key={i.id}>
                <div className="font-medium">{i.title}</div>
                <div className="text-xs text-muted">{i.message}</div>
              </li>
            ))}
            {recs.slice(0, 4).map((r) => (
              <li key={r.topic}>
                <span className="font-medium">{r.topic}: </span>
                <span className="text-muted">{r.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">Allgemeine Richtwerte – sie ändern deine Ziele nicht automatisch.</p>
        </details>
      </Card>
      <WeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} last={weight.last?.value} />
    </div>
  );
}

function MacroBar({ label, value, target, color, extra }: { label: string; value: number; target: number; color: 'protein' | 'carbs' | 'fat'; extra?: number }) {
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
      {!!extra && <div className="mt-0.5 text-[10px] text-accent">+{extra} g Training</div>}
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

function RecoveryFields({ date }: { date: string }) {
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
    <div className="space-y-3">
      <div className="space-y-3">
        <Field label="Schlafdauer (h)" hint={yesterday?.sleepHours ? `Gestern: ${yesterday.sleepHours} h` : undefined}>
          {(id) => <NumberInput id={id} value={log?.sleepHours} onValue={(v) => (v == null || (v >= 0 && v <= 24)) && update({ sleepHours: v })} />}
        </Field>
        {scale('sleepQuality', 'Schlafqualität (1 = schlecht, 5 = sehr gut)')}
        {scale('soreness', 'Muskelkater (1 = keiner, 5 = stark)')}
        {scale('energy', 'Energielevel (1 = niedrig, 5 = hoch)')}
      </div>
    </div>
  );
}

/** Schrittzähler: Schritte des Tages von Hand eintragen (z. B. von der Uhr ablesen). */
function StepsCard({ date, goal, bonus = 0, st, open, onToggle }: { date: string; goal: number; bonus?: number; st: StationState; open: boolean; onToggle: (open: boolean) => void }) {
  const week = useLiveQuery(() => db.recovery.where('date').between(addDays(date, -6), date, true, true).toArray(), [date]);
  const steps = week?.find((r) => r.date === date)?.steps;
  const save = async (v: number | undefined) => {
    if (v != null && !(v >= 0 && v <= 150000)) return;
    const cur = (await db.recovery.get(date)) ?? { id: date, date };
    await db.recovery.put({ ...cur, steps: v });
  };
  const days = Array.from({ length: 7 }, (_, k) => addDays(date, k - 6));
  const max = Math.max(goal, ...(week ?? []).map((r) => r.steps ?? 0));
  if (!open)
    return (
      <StationTile
        st={st}
        testId="steps-card"
        onOpen={() => onToggle(true)}
        value={fmt(steps ?? 0)}
        sub={steps && steps >= goal ? '✓ Schrittziel erreicht' : `von ${fmt(goal)} Schritten`}
        action={
          <Button size="sm" variant="secondary" className="w-full" onClick={() => void save((steps ?? 0) + 1000)} aria-label="1.000 Schritte hinzufügen">
            <Footprints className="h-4 w-4" /> +1.000
          </Button>
        }
      />
    );
  return (
    <SceneCard
      st={st}
      testId="steps-card"
      onClose={() => onToggle(false)}
      className="col-span-2 md:col-span-3"
      overlay={<SceneValue value={fmt(steps ?? 0)} unit="Schritte" sub={<span data-testid="steps-goal">Ziel {fmt(goal)}{bonus > 0 && <span className="text-gold"> (Set-Bonus −{fmt(bonus)})</span>}</span>} />}
    >
      <div className="flex items-end gap-3">
        <Field label="Schritte heute" className="flex-1">
          {(id) => <NumberInput id={id} inputMode="numeric" value={steps} placeholder="z. B. 8500" onValue={(v) => void save(v)} />}
        </Field>
        <Button variant="secondary" onClick={() => void save((steps ?? 0) + 1000)} aria-label="1.000 Schritte hinzufügen">
          +1.000
        </Button>
      </div>
      <Progress className="mt-3" value={steps ?? 0} max={goal} label="Schrittziel" />
      <div className="mt-1 text-xs text-muted" data-testid="steps-status">
        {steps ? (steps >= goal ? `✓ Ziel erreicht – ${fmt(steps)} Schritte` : `Noch ${fmt(goal - steps)} bis zum Ziel`) : 'Noch nichts eingetragen'}
      </div>
      <div className="mt-3 flex h-12 items-end gap-1" aria-label="Schritte der letzten 7 Tage">
        {days.map((d) => {
          const v = week?.find((r) => r.date === d)?.steps ?? 0;
          return (
            <div key={d} className="flex flex-1 flex-col items-center gap-0.5" title={`${d}: ${fmt(v)} Schritte`}>
              <div className={v >= goal ? 'w-full rounded-t bg-accent' : 'w-full rounded-t bg-fg/20'} style={{ height: `${Math.max(2, (v / max) * 36)}px` }} />
              <span className="text-[9px] text-muted">{new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'narrow' })}</span>
            </div>
          );
        })}
      </div>
    </SceneCard>
  );
}

/** Erklärt den Unterschied: Stufe = Kampfkraft des Helden, Rang = Freischaltungen im Markt und Lager. */
function LevelRankSheet({ game, onClose }: { game: GameState; onClose: () => void }) {
  const lv = game.level;
  const r = game.rank;
  return (
    <Sheet open onClose={onClose} title="Stufe und Rang">
      <div className="space-y-4 text-sm" data-testid="level-rank-sheet">
        <p className="text-muted">Beides wächst aus denselben Erfahrungspunkten (EP) – aber es bedeutet etwas anderes.</p>
        <div className="rounded-xl border p-3">
          <div className="flex items-center gap-2 font-semibold">
            <Swords className="h-4 w-4 text-gold" /> Stufe {lv.level} · Kampfkraft
          </div>
          <p className="mt-1 text-muted">Steigt oft und in kleinen Schritten. Sie erhöht Angriff, Verteidigung und Leben deines Helden und öffnet neue Regionen auf der Weltkarte.</p>
          {lv.next && <p className="mt-1 text-xs">Noch {fmt(lv.toNext)} EP bis Stufe {lv.level + 1}.</p>}
        </div>
        <div className="rounded-xl border p-3">
          <div className="flex items-center gap-2 font-semibold">
            <Crown className="h-4 w-4 text-gold" /> Rang {r.rank.level} · {r.rank.name} ({r.rank.title})
          </div>
          <p className="mt-1 text-muted">Steigt selten (10 Ränge). Jeder Rang schaltet im Markt neue Rüstungs- und Waffenklassen frei, lässt dein Lager wachsen und bringt 3 Aktionspunkte als Beförderungssold.</p>
          {r.next && <p className="mt-1 text-xs">Noch {fmt(r.toNext)} EP bis {r.next.name}.</p>}
        </div>
      </div>
    </Sheet>
  );
}
