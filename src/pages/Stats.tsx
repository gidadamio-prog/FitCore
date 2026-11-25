import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGame } from '@/hooks/game';
import { FameTab } from './Achievements';
import { Badge, Card, CardTitle, Field, Input, Select, Stat, Tabs, fmt } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { useAllEntries, useCardio, useGoals, useMeasurements, useWorkouts } from '@/hooks/data';
import { addDays, today, rangeDates, startOfWeek, formatDate } from '@/domain/dates';
import { average, calorieGoalRate, dailyNutrition, dailyTraining, macroDistribution, proteinGoalRate, trainingSummary, weekly, weeklyReport } from '@/domain/stats';
import { dailySeries, emaTrend, fatMass } from '@/domain/body';
import { exerciseHistory, personalRecords, setsPerMuscle } from '@/domain/training';
import { goalForDate, sessionKcal } from '@/domain/balance';
import { KCAL_PER_KG_BODY_MASS } from '@/domain/energy';
import { BarSeriesChart, LineSeriesChart, SERIES } from '@/components/charts';

type Range = '7' | '30' | '90' | '365' | 'custom';
type Section = 'ruhm' | 'nutrition' | 'training' | 'body' | 'combined' | 'report';
const SECTIONS: Section[] = ['ruhm', 'nutrition', 'training', 'body', 'combined', 'report'];

export function Stats() {
  const [range, setRange] = useState<Range>('30');
  const [custom, setCustom] = useState({ from: addDays(today(), -60), to: today() });
  const [params] = useSearchParams();
  const wanted = params.get('section') as Section | null;
  const [section, setSection] = useState<Section>(wanted && SECTIONS.includes(wanted) ? wanted : 'nutrition');
  useEffect(() => {
    if (wanted && SECTIONS.includes(wanted)) setSection(wanted);
  }, [wanted]);
  const game = useGame();
  const from = range === 'custom' ? custom.from : addDays(today(), -(Number(range) - 1));
  const to = range === 'custom' ? custom.to : today();
  return (
    <div className="space-y-4">
      <PageHeader title="Statistiken" subtitle={section === 'ruhm' ? 'Rang, Abzeichen und geheime Erfolge – aus deinen echten Einträgen.' : `${formatDate(from, { day: '2-digit', month: '2-digit', year: 'numeric' })} – ${formatDate(to, { day: '2-digit', month: '2-digit', year: 'numeric' })}`} />
      <Tabs value={section} onChange={setSection} items={[{ value: 'ruhm', label: 'Ruhm' }, { value: 'nutrition', label: 'Ernährung' }, { value: 'training', label: 'Training' }, { value: 'body', label: 'Körper' }, { value: 'combined', label: 'Kombiniert' }, { value: 'report', label: 'Wochenbericht' }]} />
      {section === 'ruhm' ? (
        game ? <FameTab game={game} /> : null
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
        <Tabs value={range} onChange={setRange} items={[{ value: '7', label: '7 T' }, { value: '30', label: '30 T' }, { value: '90', label: '90 T' }, { value: '365', label: '1 Jahr' }, { value: 'custom', label: 'Eigene' }]} className="sm:w-96" />
        {range === 'custom' && (
          <div className="flex gap-2">
            <Input type="date" aria-label="Von" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <Input type="date" aria-label="Bis" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </div>
        )}
      </div>
      {from > to ? (
        <p className="text-sm text-danger">Startdatum liegt nach dem Enddatum.</p>
      ) : (
        <>
          {section === 'nutrition' && <NutritionStats from={from} to={to} />}
          {section === 'training' && <TrainingStats from={from} to={to} />}
          {section === 'body' && <BodyStats from={from} to={to} />}
          {section === 'combined' && <Combined from={from} to={to} />}
          {section === 'report' && <WeeklyReportView />}
        </>
      )}
        </>
      )}
    </div>
  );
}

function useTrainingDates() {
  const w = useWorkouts();
  const c = useCardio();
  return useMemo(() => new Set([...w.map((x) => x.date), ...c.map((x) => x.date)]), [w, c]);
}

function NutritionStats({ from, to }: { from: string; to: string }) {
  const entries = useAllEntries();
  const goals = useGoals();
  const tdates = useTrainingDates();
  const days = useMemo(() => dailyNutrition(entries, goals, from, to, tdates), [entries, goals, from, to, tdates]);
  const rate = calorieGoalRate(days);
  const prate = proteinGoalRate(days);
  const dist = macroDistribution(days);
  const train = days.filter((d) => d.logged && d.trainingDay);
  const rest = days.filter((d) => d.logged && !d.trainingDay);
  const avgTarget = average(days.map((d) => d.target));
  const weeks = weekly(days, (r) => average(r.map((d) => d.kcal)));
  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ø Kalorien" value={<span data-testid="avg-kcal">{fmt(average(days.map((d) => d.kcal)))}</span>} unit="kcal" sub={`über ${rate.evaluableDays} protokollierte Tage`} />
        <Stat label="Kalorienziel getroffen" value={rate.rate == null ? '–' : `${Math.round(rate.rate * 100)} %`} sub={`${rate.hitDays}/${rate.evaluableDays} Tage (±10 %)`} />
        <Stat label="Proteinziel erreicht" value={prate.rate == null ? '–' : `${Math.round(prate.rate * 100)} %`} sub={`${prate.hitDays}/${prate.evaluableDays} Tage (≥90 %)`} />
        <Stat label="Datenlücken" value={rate.missingDates.length} unit="Tage" sub={`von ${days.length} Tagen ohne Einträge`} />
      </Card>
      <Card>
        <CardTitle>Kalorienverlauf</CardTitle>
        <BarSeriesChart data={days.map((d) => ({ date: d.date, kcal: d.kcal }))} series={[{ key: 'kcal', label: 'Kalorien', color: SERIES.s1, unit: 'kcal' }]} refY={avgTarget ? { y: avgTarget, label: 'Ø Ziel' } : undefined} />
        <p className="text-[11px] text-muted">Tage ohne Einträge erscheinen als Lücke, nicht als 0 kcal.</p>
      </Card>
      <Card>
        <CardTitle>Makronährstoffe (g)</CardTitle>
        <LineSeriesChart
          data={days.map((d) => ({ date: d.date, p: d.protein, c: d.carbs, f: d.fat }))}
          series={[
            { key: 'p', label: 'Protein', color: SERIES.s1, unit: 'g', dots: days.length <= 31 },
            { key: 'c', label: 'Kohlenhydrate', color: SERIES.s2, unit: 'g', dots: days.length <= 31 },
            { key: 'f', label: 'Fett', color: SERIES.s3, unit: 'g', dots: days.length <= 31 },
          ]}
        />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Makroverteilung (Energieanteil)</CardTitle>
          {dist ? (
            <div className="space-y-2">
              <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
                <div className="bg-protein" style={{ width: dist.protein + '%' }} />
                <div className="bg-carbs" style={{ width: dist.carbs + '%' }} />
                <div className="bg-fat" style={{ width: dist.fat + '%' }} />
              </div>
              <div className="flex justify-between text-sm">
                <span>Protein {dist.protein} %</span>
                <span>Kohlenhydrate {dist.carbs} %</span>
                <span>Fett {dist.fat} %</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Keine Daten.</p>
          )}
        </Card>
        <Card>
          <CardTitle>Trainingstage vs. Ruhetage</CardTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th />
                <th className="text-right">Tage</th>
                <th className="text-right">Ø kcal</th>
                <th className="text-right">Ø Protein</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-1.5">Trainingstage</td>
                <td className="text-right">{train.length}</td>
                <td className="text-right tabular-nums">{fmt(average(train.map((d) => d.kcal)))}</td>
                <td className="text-right tabular-nums">{fmt(average(train.map((d) => d.protein)))} g</td>
              </tr>
              <tr className="border-t">
                <td className="py-1.5">Ruhetage</td>
                <td className="text-right">{rest.length}</td>
                <td className="text-right tabular-nums">{fmt(average(rest.map((d) => d.kcal)))}</td>
                <td className="text-right tabular-nums">{fmt(average(rest.map((d) => d.protein)))} g</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted">Nur protokollierte Tage.</p>
        </Card>
      </div>
      <Card>
        <CardTitle>Wochentrend (Ø kcal pro Woche)</CardTitle>
        <BarSeriesChart data={weeks.map((w) => ({ date: w.week, kcal: w.value }))} series={[{ key: 'kcal', label: 'Ø kcal', color: SERIES.s1, unit: 'kcal' }]} />
      </Card>
    </div>
  );
}

function TrainingStats({ from, to }: { from: string; to: string }) {
  const workouts = useWorkouts();
  const cardio = useCardio();
  const [exId, setExId] = useState('');
  const days = useMemo(() => dailyTraining(workouts, cardio, from, to), [workouts, cardio, from, to]);
  const sum = trainingSummary(days);
  const inRange = workouts.filter((w) => w.date >= from && w.date <= to);
  const muscles = Object.entries(setsPerMuscle(inRange)).sort((a, b) => b[1] - a[1]);
  const prsInRange = personalRecords(workouts).filter((p) => p.date >= from && p.date <= to);
  const exIds = [...new Set(inRange.flatMap((w) => w.exercises.map((e) => e.exerciseId)))];
  const names = new Map(inRange.flatMap((w) => w.exercises.map((e) => [e.exerciseId, e.name] as const)));
  const sel = exId || exIds[0] || '';
  const hist = sel ? exerciseHistory(inRange, sel) : [];
  const weeks = weekly(days, (r) => r.reduce((a, d) => a + d.workouts + d.cardio, 0));
  const weekVol = weekly(days, (r) => r.reduce((a, d) => a + d.volume, 0));
  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Einheiten" value={<span data-testid="sessions">{sum.sessions}</span>} sub={`${sum.strengthSessions} Kraft · ${sum.cardioSessions} Ausdauer`} />
        <Stat label="Trainingszeit" value={fmt(sum.durationMin / 60, 1)} unit="h" />
        <Stat label="Sätze / Wdh." value={`${sum.sets} / ${sum.reps}`} />
        <Stat label="Volumen" value={<span data-testid="total-volume">{fmt(sum.volume)}</span>} unit="kg" />
      </Card>
      <Card>
        <CardTitle>Trainingshäufigkeit pro Woche</CardTitle>
        <BarSeriesChart data={weeks.map((w) => ({ date: w.week, n: w.value }))} series={[{ key: 'n', label: 'Einheiten', color: SERIES.s1 }]} />
      </Card>
      <Card>
        <CardTitle>Trainingsvolumen pro Woche</CardTitle>
        <BarSeriesChart data={weekVol.map((w) => ({ date: w.week, v: w.value }))} series={[{ key: 'v', label: 'Volumen', color: SERIES.s1, unit: 'kg' }]} />
      </Card>
      <Card>
        <CardTitle
          action={
            exIds.length > 0 && (
              <Select aria-label="Übung" value={sel} onChange={(e) => setExId(e.target.value)} className="h-9 w-48 text-sm">
                {exIds.map((id) => (
                  <option key={id} value={id}>
                    {names.get(id)}
                  </option>
                ))}
              </Select>
            )
          }
        >
          Kraftentwicklung
        </CardTitle>
        <LineSeriesChart data={hist.map((h) => ({ date: h.date, e1rm: h.bestE1RM, top: h.topWeight }))} series={[{ key: 'top', label: 'Höchstes Gewicht', color: SERIES.s1, unit: 'kg', dots: true, digits: 1 }, { key: 'e1rm', label: 'Geschätztes 1RM', color: SERIES.s2, unit: 'kg', dots: true, dashed: true, digits: 1 }]} />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Muskelgruppenverteilung (Sätze)</CardTitle>
          {muscles.length ? (
            <ul className="space-y-1.5">
              {muscles.map(([m, n]) => (
                <li key={m} className="text-sm">
                  <div className="flex justify-between">
                    <span>{m}</span>
                    <span className="tabular-nums text-muted">{fmt(n, 1)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-fg/[0.06]">
                    <div className="h-2 rounded-full bg-protein" style={{ width: `${(n / muscles[0]![1]) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Keine Daten.</p>
          )}
          <p className="mt-2 text-[11px] text-muted">Sekundäre Muskeln zählen 0,5 Sätze.</p>
        </Card>
        <Card>
          <CardTitle>Bestleistungen im Zeitraum</CardTitle>
          {prsInRange.length ? (
            <ul className="space-y-1 text-sm">
              {prsInRange.filter((p) => p.kind === 'weight' || p.kind === 'e1rm').slice(0, 12).map((p) => (
                <li key={p.exerciseId + p.kind} className="flex justify-between gap-2">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {p.kind === 'e1rm' ? 'e1RM ' : ''}
                    {fmt(p.value, 1)} kg
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Keine Bestleistungen in diesem Zeitraum.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function BodyStats({ from, to }: { from: string; to: string }) {
  const ms = useMeasurements();
  const inRange = ms.filter((m) => m.date >= from && m.date <= to);
  const pts = dailySeries(ms);
  const ema = emaTrend(pts);
  const w = pts.map((p, i) => ({ date: p.date, weight: Math.round(p.value * 10) / 10, trend: ema[i]!.value })).filter((p) => p.date >= from && p.date <= to);
  const comp = inRange.filter((m) => m.weightKg && m.bodyFatPct != null).map((m) => ({ date: m.date, bf: m.bodyFatPct, ...(() => { const r = fatMass(m.weightKg!, m.bodyFatPct!); return { fat: r.fatMassKg, lean: r.leanMassKg }; })() }));
  const first = w[0];
  const last = w[w.length - 1];
  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Messungen" value={inRange.length} />
        <Stat label="Veränderung (Trend)" value={first && last ? `${last.trend - first.trend > 0 ? '+' : ''}${fmt(last.trend - first.trend, 1)}` : '–'} unit="kg" />
        <Stat label="Körperfett zuletzt" value={fmt(comp[comp.length - 1]?.bf, 1)} unit="%" />
        <Stat label="Fettfreie Masse zuletzt" value={fmt(comp[comp.length - 1]?.lean, 1)} unit="kg" sub="berechnet" />
      </Card>
      <Card>
        <CardTitle>Gewichtsentwicklung</CardTitle>
        <LineSeriesChart data={w} series={[{ key: 'weight', label: 'Messung', color: SERIES.muted, unit: 'kg', dots: true, digits: 1 }, { key: 'trend', label: 'Trend', color: SERIES.s1, unit: 'kg', connect: true, digits: 1 }]} />
      </Card>
      <Card>
        <CardTitle>Körperfett (%)</CardTitle>
        <LineSeriesChart data={comp} series={[{ key: 'bf', label: 'Körperfett', color: SERIES.s2, unit: '%', dots: true, digits: 1 }]} />
      </Card>
      <Card>
        <CardTitle>Fettmasse & fettfreie Masse (berechnet, kg)</CardTitle>
        <LineSeriesChart data={comp} series={[{ key: 'lean', label: 'Fettfreie Masse', color: SERIES.s1, unit: 'kg', dots: true, digits: 1 }, { key: 'fat', label: 'Fettmasse', color: SERIES.s2, unit: 'kg', dots: true, digits: 1 }]} />
      </Card>
      <Card>
        <CardTitle>Umfangsentwicklung (cm)</CardTitle>
        <LineSeriesChart
          data={inRange.filter((m) => m.waistCm || m.abdomenCm || m.chestCm || m.armCm || m.thighCm).map((m) => ({ date: m.date, waist: m.waistCm ?? m.abdomenCm ?? null, chest: m.chestCm ?? null, arm: m.armCm ?? null }))}
          series={[{ key: 'waist', label: 'Taille/Bauch', color: SERIES.s1, unit: 'cm', dots: true, digits: 1 }, { key: 'chest', label: 'Brust', color: SERIES.s2, unit: 'cm', dots: true, digits: 1 }, { key: 'arm', label: 'Oberarm', color: SERIES.s3, unit: 'cm', dots: true, digits: 1 }]}
        />
      </Card>
    </div>
  );
}

function Combined({ from, to }: { from: string; to: string }) {
  const ms = useMeasurements();
  const entries = useAllEntries();
  const goals = useGoals();
  const workouts = useWorkouts();
  const cardio = useCardio();
  const tdates = useTrainingDates();
  const data = useMemo(() => {
    const pts = dailySeries(ms);
    const ema = emaTrend(pts);
    const trendBy = new Map(pts.map((p, i) => [p.date, ema[i]!.value]));
    const nut = dailyNutrition(entries, goals, from, to, tdates);
    const tr = dailyTraining(workouts, cardio, from, to);
    const rows = rangeDates(from, to).map((date, i) => {
      const g = goalForDate(goals, date);
      const trainKcal = workouts.filter((w) => w.date === date).reduce((a, w) => a + sessionKcal(w), 0) + cardio.filter((c) => c.date === date).reduce((a, c) => a + sessionKcal(c), 0);
      const kcal = nut[i]!.kcal;
      return {
        date,
        weight: trendBy.get(date) ?? null,
        kcal,
        volume: tr[i]!.volume || null,
        balance: kcal != null && g ? Math.round(kcal - (g.tdee + trainKcal)) : null,
      };
    });
    // Indexierte Kraft (Ø e1RM aller Übungen relativ zur ersten Einheit) und Gewicht – gleiche Achse (Index = 100)
    const inRange = workouts.filter((w) => w.date >= from && w.date <= to);
    const ids = [...new Set(inRange.flatMap((w) => w.exercises.map((e) => e.exerciseId)))];
    const strengthByDate = new Map<string, number[]>();
    for (const id of ids) {
      const h = exerciseHistory(inRange, id).filter((x) => x.bestE1RM);
      if (h.length < 2) continue;
      const base = h[0]!.bestE1RM!;
      for (const x of h) strengthByDate.set(x.date, [...(strengthByDate.get(x.date) ?? []), (x.bestE1RM! / base) * 100]);
    }
    const wBase = rows.find((r) => r.weight != null)?.weight;
    const indexed = rows.map((r) => ({ date: r.date, strength: strengthByDate.has(r.date) ? Math.round(average(strengthByDate.get(r.date)!)! * 10) / 10 : null, weight: r.weight != null && wBase ? Math.round((r.weight / wBase) * 1000) / 10 : null }));
    // Proteinzufuhr an Trainingstagen
    const tDays = nut.filter((d) => d.logged && d.trainingDay);
    const rDays = nut.filter((d) => d.logged && !d.trainingDay);
    // Energiebilanz vs. Gewichtstrend (wöchentlich)
    const weeks = new Map<string, { bal: number[]; w: number[] }>();
    for (const r of rows) {
      const k = startOfWeek(r.date);
      const o = weeks.get(k) ?? { bal: [], w: [] };
      if (r.balance != null) o.bal.push(r.balance);
      if (r.weight != null) o.w.push(r.weight);
      weeks.set(k, o);
    }
    const weekRows = [...weeks.entries()].map(([week, o]) => ({
      date: week,
      predicted: o.bal.length >= 4 ? Math.round(((average(o.bal)! * 7) / KCAL_PER_KG_BODY_MASS) * 100) / 100 : null,
      observed: o.w.length >= 2 ? Math.round((o.w[o.w.length - 1]! - o.w[0]!) * 100) / 100 : null,
      days: o.bal.length,
    }));
    const bfRows = ms.filter((m) => m.date >= from && m.date <= to && m.bodyFatPct != null).map((m) => ({ date: m.date, bf: m.bodyFatPct }));
    return { rows, indexed, tDays, rDays, weekRows, bfRows };
  }, [ms, entries, goals, workouts, cardio, from, to, tdates]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Kombinierte Ansichten zeigen gleichzeitige Entwicklungen (Korrelationen) – sie beweisen keine Ursache. Zwei Größen mit unterschiedlichen Einheiten werden in übereinander liegenden Diagrammen mit gleicher Zeitachse dargestellt.</p>
      <Card>
        <CardTitle>Gewicht & Kalorienaufnahme</CardTitle>
        <LineSeriesChart data={data.rows} series={[{ key: 'weight', label: 'Gewichtstrend', color: SERIES.s1, unit: 'kg', connect: true, digits: 1 }]} height={150} />
        <BarSeriesChart data={data.rows} series={[{ key: 'kcal', label: 'Kalorien', color: SERIES.s2, unit: 'kcal' }]} height={130} />
      </Card>
      <Card>
        <CardTitle>Gewicht & Trainingsvolumen</CardTitle>
        <LineSeriesChart data={data.rows} series={[{ key: 'weight', label: 'Gewichtstrend', color: SERIES.s1, unit: 'kg', connect: true, digits: 1 }]} height={150} />
        <BarSeriesChart data={data.rows} series={[{ key: 'volume', label: 'Volumen', color: SERIES.s3, unit: 'kg' }]} height={130} />
      </Card>
      <Card>
        <CardTitle>Kraftentwicklung & Körpergewicht (Index, Start = 100)</CardTitle>
        <LineSeriesChart data={data.indexed} series={[{ key: 'strength', label: 'Kraft (Ø e1RM-Index)', color: SERIES.s2, dots: true, connect: true, digits: 1 }, { key: 'weight', label: 'Körpergewicht (Index)', color: SERIES.s1, connect: true, digits: 1 }]} refY={{ y: 100, label: 'Start' }} />
      </Card>
      <Card>
        <CardTitle>Körperfett & Training</CardTitle>
        <LineSeriesChart data={data.bfRows} series={[{ key: 'bf', label: 'Körperfett', color: SERIES.s2, unit: '%', dots: true, digits: 1 }]} height={150} />
        <BarSeriesChart data={data.rows} series={[{ key: 'volume', label: 'Volumen', color: SERIES.s3, unit: 'kg' }]} height={130} />
      </Card>
      <Card>
        <CardTitle>Proteinzufuhr an Trainingstagen</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Trainingstage" value={fmt(average(data.tDays.map((d) => d.protein)))} unit="g Ø" sub={`${data.tDays.length} Tage · Ziel erreicht an ${data.tDays.filter((d) => d.proteinTarget && d.protein! >= d.proteinTarget * 0.9).length}`} />
          <Stat label="Ruhetage" value={fmt(average(data.rDays.map((d) => d.protein)))} unit="g Ø" sub={`${data.rDays.length} Tage · Ziel erreicht an ${data.rDays.filter((d) => d.proteinTarget && d.protein! >= d.proteinTarget * 0.9).length}`} />
        </div>
      </Card>
      <Card>
        <CardTitle action={<Badge tone="warn">Schätzung</Badge>}>Geschätzte Energiebilanz & Gewichtstrend (pro Woche)</CardTitle>
        <BarSeriesChart
          data={data.weekRows}
          series={[
            { key: 'predicted', label: 'Erwartet aus Bilanz', color: SERIES.s2, unit: 'kg', digits: 2 },
            { key: 'observed', label: 'Beobachtet (Trend)', color: SERIES.s1, unit: 'kg', digits: 2 },
          ]}
        />
        <p className="mt-1 text-[11px] text-muted">Bilanz = Aufnahme − (geschätzter Gesamtbedarf + geschätzte Trainingsenergie); erwartete Veränderung = Ø Bilanz × 7 / 7700 kcal/kg. Nur Wochen mit ≥ 4 protokollierten Tagen.</p>
      </Card>
    </div>
  );
}

function WeeklyReportView() {
  const entries = useAllEntries();
  const goals = useGoals();
  const workouts = useWorkouts();
  const cardio = useCardio();
  const ms = useMeasurements();
  const [offset, setOffset] = useState(0);
  const from = addDays(startOfWeek(today()), -7 * offset);
  const to = addDays(from, 6);
  const r = weeklyReport(entries, goals, workouts, cardio, ms, from, to, addDays(from, -7), addDays(from, -1));
  const delta = (v: number | null, unit: string, digits = 0) => (v == null ? <span className="text-muted">kein Vergleich</span> : <span>{v > 0 ? '+' : ''}{fmt(v, digits)} {unit}</span>);
  return (
    <Card data-testid="weekly-report">
      <CardTitle
        action={
          <Field label="" className="w-40">
            {(id) => (
              <Select id={id} aria-label="Woche" value={offset} onChange={(e) => setOffset(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? 'Diese Woche' : i === 1 ? 'Letzte Woche' : `vor ${i} Wochen`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        }
      >
        Woche {formatDate(from, { day: '2-digit', month: '2-digit' })} – {formatDate(to, { day: '2-digit', month: '2-digit' })}
      </CardTitle>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1">Kennzahl</th>
            <th className="py-1 text-right">Diese</th>
            <th className="py-1 text-right">Vorwoche</th>
            <th className="py-1 text-right">Veränderung</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="py-1.5">Ø Kalorien ({r.loggedDays} Tage protokolliert)</td>
            <td className="text-right tabular-nums">{fmt(r.avgKcal)}</td>
            <td className="text-right tabular-nums">{fmt(r.prev.avgKcal)}</td>
            <td className="text-right">{delta(r.delta.avgKcal, 'kcal')}</td>
          </tr>
          <tr className="border-t">
            <td className="py-1.5">Ø Protein</td>
            <td className="text-right tabular-nums">{fmt(r.avgProtein)} g</td>
            <td className="text-right tabular-nums">{fmt(r.prev.avgProtein)} g</td>
            <td className="text-right">{delta(r.delta.avgProtein, 'g')}</td>
          </tr>
          <tr className="border-t">
            <td className="py-1.5">Trainingseinheiten</td>
            <td className="text-right tabular-nums">{r.sessions}</td>
            <td className="text-right tabular-nums">{r.prev.sessions}</td>
            <td className="text-right">{delta(r.delta.sessions, '')}</td>
          </tr>
          <tr className="border-t">
            <td className="py-1.5">Volumen</td>
            <td className="text-right tabular-nums">{fmt(r.volume)} kg</td>
            <td className="text-right tabular-nums">{fmt(r.prev.volume)} kg</td>
            <td className="text-right">{delta(r.delta.volume, 'kg')}</td>
          </tr>
          <tr className="border-t">
            <td className="py-1.5">Ø Gewicht</td>
            <td className="text-right tabular-nums">{fmt(r.avgWeight, 1)} kg</td>
            <td className="text-right tabular-nums">{fmt(r.prev.avgWeight, 1)} kg</td>
            <td className="text-right">{delta(r.delta.avgWeight, 'kg', 1)}</td>
          </tr>
        </tbody>
      </table>
    </Card>
  );
}
