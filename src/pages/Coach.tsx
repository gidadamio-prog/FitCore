import { useMemo } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Info, Ban, Trophy } from 'lucide-react';
import { Badge, Button, Card, CardTitle } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { useAllEntries, useCardio, useGoals, useMeasurements, usePlans, useProfile, useWorkouts } from '@/hooks/data';
import { coachInsights, classifyDay, dayRecommendations, DAY_TYPE_LABELS, type CoachInsight } from '@/domain/coach';
import { today } from '@/domain/dates';
import { goalForDate } from '@/domain/balance';
import { addGoalVersion } from '@/data/profileRepo';
import { confirmDialog, toast } from '@/stores/ui';
import { dailySeries } from '@/domain/body';
import { personalRecords } from '@/domain/training';

export function Coach() {
  const profile = useProfile();
  const ms = useMeasurements();
  const entries = useAllEntries();
  const goals = useGoals();
  const workouts = useWorkouts();
  const cardio = useCardio();
  const plans = usePlans();
  const plan = plans.find((p) => p.status === 'active');
  const date = today();
  const insights = useMemo(
    () => (profile ? coachInsights({ asOf: date, measurements: ms, entries, goals, workouts, cardio, activePlan: plan, sex: profile.sex, deficitAllowed: profile.specialSituation === 'none' }) : []),
    [profile, date, ms, entries, goals, workouts, cardio, plan],
  );
  const goal = goalForDate(goals, date);
  const pts = dailySeries(ms);
  const type = classifyDay(date, workouts, cardio, plan);
  const recs = dayRecommendations(type, pts[pts.length - 1]?.value ?? null, goal);
  const milestones = useMemo(() => {
    const out: string[] = [];
    const n = workouts.length;
    for (const m of [1, 10, 25, 50, 100, 250]) if (n >= m) out.push(`${m} Workout${m > 1 ? 's' : ''} abgeschlossen`);
    const prs = personalRecords(workouts).filter((p) => p.kind === 'weight').length;
    if (prs) out.push(`${prs} Übungen mit dokumentierter Gewichtsbestleistung`);
    const days = new Set(entries.map((e) => e.date)).size;
    for (const m of [7, 30, 100, 365]) if (days >= m) out.push(`${m} Tage Ernährung protokolliert`);
    return out.slice(-5);
  }, [workouts, entries]);

  const apply = async (i: CoachInsight) => {
    if (!i.proposal || !goal) return;
    const carbsDelta = Math.round(i.proposal.deltaKcal / 4);
    const ok = await confirmDialog({
      title: 'Zielanpassung übernehmen?',
      text: `Kalorienziel: ${goal.calorieTarget} → ${i.proposal.newTarget} kcal (${i.proposal.deltaKcal > 0 ? '+' : ''}${i.proposal.deltaKcal}).\nKohlenhydrate: ${goal.carbsG} → ${Math.max(0, goal.carbsG + carbsDelta)} g. Protein und Fett bleiben gleich.\n\nGrundlage: ${i.basis.join(', ')}.\nDie Änderung gilt ab heute; frühere Tage bleiben unverändert.`,
      confirmLabel: 'Übernehmen',
    });
    if (!ok) return;
    await addGoalVersion({ ...goal, id: undefined, effectiveFrom: undefined, calorieTarget: i.proposal.newTarget, carbsG: Math.max(0, goal.carbsG + carbsDelta), adjustmentKcal: i.proposal.newTarget - goal.tdee, manualCalories: true, reason: 'Coach-Vorschlag (bestätigt)' } as never);
    toast('Ziel angepasst', 'success');
  };

  const icon = (k: CoachInsight['kind']) => (k === 'positive' ? <CheckCircle2 className="h-5 w-5 text-accent" /> : k === 'attention' ? <AlertCircle className="h-5 w-5 text-warn" /> : k === 'limitation' ? <Ban className="h-5 w-5 text-muted" /> : <Info className="h-5 w-5 text-protein" />);
  return (
    <div className="space-y-4">
      <PageHeader title="Coach" subtitle="Nachvollziehbare Hinweise aus deinen Daten – nichts wird automatisch geändert." />
      <div className="grid gap-3 md:grid-cols-2">
        {insights.map((i) => (
          <Card key={i.id} data-testid="insight">
            <div className="flex gap-3">
              {icon(i.kind)}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="font-semibold">{i.title}</div>
                <p className="text-sm">{i.message}</p>
                <div>
                  <div className="text-xs font-medium text-muted">Datengrundlage</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {i.basis.map((b) => (
                      <Badge key={b}>{b}</Badge>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted">
                  <span className="font-medium">Begründung: </span>
                  {i.reasoning}
                </p>
                {i.proposal && (
                  <Button size="sm" variant="outline" onClick={() => apply(i)}>
                    Vorschlag prüfen: {i.proposal.deltaKcal > 0 ? '+' : ''}
                    {i.proposal.deltaKcal} kcal
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <CardTitle>
          <span className="flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-accent" /> Ernährung am {DAY_TYPE_LABELS[type]}
          </span>
        </CardTitle>
        <ul className="space-y-2 text-sm">
          {recs.map((r) => (
            <li key={r.topic}>
              <div className="font-medium">{r.topic}</div>
              <div>{r.text}</div>
              <div className="text-xs text-muted">Grundlage: {r.basis}</div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted">Allgemeine Richtwerte für gesunde Erwachsene, keine medizinische Beratung. Sie verändern deine gespeicherten Ziele nicht.</p>
      </Card>
      {milestones.length > 0 && (
        <Card>
          <CardTitle>
            <span className="flex items-center gap-1">
              <Trophy className="h-4 w-4 text-warn" /> Meilensteine
            </span>
          </CardTitle>
          <ul className="space-y-1 text-sm">
            {milestones.map((m) => (
              <li key={m}>✓ {m}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
