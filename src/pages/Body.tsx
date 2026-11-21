import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Ruler, Trash2, Info } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Empty, Field, Input, NumberInput, Select, Sheet, Stat, Tabs, Textarea, fmt } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { useMeasurements, useProfile } from '@/hooks/data';
import { MEASUREMENT_FIELDS, compareMeasurements, dailySeries, emaTrend, fatMass, forecastGoal, goalProgress, movingAverage, navyBodyFat, windowTrend } from '@/domain/body';
import { deleteMeasurement, saveMeasurement, type MeasurementInput } from '@/data/bodyRepo';
import { addDays, formatDate, today } from '@/domain/dates';
import { toast, confirmDialog } from '@/stores/ui';
import { firstError, fieldErrors } from '@/domain/schemas';
import type { Measurement } from '@/domain/types';
import { LineSeriesChart, PointsWithTrend, SERIES } from '@/components/charts';
import { z } from 'zod';

type Tab = 'trend' | 'list' | 'navy' | 'compare';

export function Body() {
  const [tab, setTab] = useState<Tab>('trend');
  const [edit, setEdit] = useState<Measurement | 'new' | null>(null);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Körper"
        action={
          <Button onClick={() => setEdit('new')}>
            <Plus className="h-4 w-4" /> Messung
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'trend', label: 'Verlauf' },
          { value: 'list', label: 'Messungen' },
          { value: 'navy', label: 'Navy-Rechner' },
          { value: 'compare', label: 'Vergleich' },
        ]}
      />
      {tab === 'trend' && <Trend />}
      {tab === 'list' && <MeasurementList onEdit={setEdit} />}
      {tab === 'navy' && <NavyCalculator />}
      {tab === 'compare' && <Compare />}
      {edit && <MeasurementForm initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function Trend() {
  const ms = useMeasurements();
  const profile = useProfile();
  const [range, setRange] = useState<'30' | '90' | '365' | 'all'>('90');
  const d = useMemo(() => {
    const pts = dailySeries(ms);
    const ema = emaTrend(pts);
    const ma7 = movingAverage(pts, 7);
    const from = range === 'all' ? '0000' : addDays(today(), -Number(range));
    const chart = pts.map((p, i) => ({ date: p.date, weight: Math.round(p.value * 10) / 10, trend: ema[i]!.value, ma7: ma7[i]!.value })).filter((p) => p.date >= from);
    const bf = ms.filter((m) => m.bodyFatPct != null && m.date >= from).map((m) => ({ date: m.date, manual: m.bodyFatMethod !== 'navy' ? m.bodyFatPct : null, navy: m.bodyFatMethod === 'navy' ? m.bodyFatPct : null }));
    const comp = ms
      .filter((m) => m.bodyFatPct != null && m.weightKg != null && m.date >= from)
      .map((m) => {
        const r = fatMass(m.weightKg!, m.bodyFatPct!);
        return { date: m.date, fat: r.fatMassKg, lean: r.leanMassKg };
      });
    const circ = ms.filter((m) => m.date >= from && (m.waistCm || m.abdomenCm || m.hipCm)).map((m) => ({ date: m.date, waist: m.waistCm ?? null, abdomen: m.abdomenCm ?? null, hip: m.hipCm ?? null }));
    const first = pts[0];
    const cur = ema[ema.length - 1];
    return { pts, chart, bf, comp, circ, first, cur, w7: windowTrend(pts, 7, today()), w14: windowTrend(pts, 14, today()), w30: windowTrend(pts, 30, today()) };
  }, [ms, range]);
  if (!d.pts.length) return <Empty icon={<Ruler className="h-8 w-8" />} title="Noch keine Gewichtsdaten" text="Erfasse dein Gewicht regelmäßig – idealerweise morgens nüchtern." />;
  const target = profile?.targetWeightKg;
  const prog = target && d.first && d.cur ? goalProgress(d.first.value, d.cur.value, target) : null;
  const fc = target ? forecastGoal(d.pts, target) : null;
  const trendStat = (t: ReturnType<typeof windowTrend>, label: string) => (
    <Stat label={label} value={t.kgPerWeek == null ? '–' : `${t.kgPerWeek > 0 ? '+' : ''}${fmt(t.kgPerWeek, 2)}`} unit={t.kgPerWeek == null ? undefined : 'kg/Woche'} sub={t.n < 2 ? 'zu wenig Messungen' : `${t.n} Messungen`} />
  );
  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Aktueller Trend" value={fmt(d.cur?.value, 1)} unit="kg" sub={`letzte Messung ${fmt(d.pts[d.pts.length - 1]!.value, 1)} kg`} />
        <Stat label="Seit Beginn" value={d.cur && d.first ? `${d.cur.value - d.first.value > 0 ? '+' : ''}${fmt(d.cur.value - d.first.value, 1)}` : '–'} unit="kg" sub={`Start ${formatDate(d.first!.date, { day: '2-digit', month: '2-digit', year: '2-digit' })}: ${fmt(d.first!.value, 1)} kg`} />
        {trendStat(d.w7, '7-Tage-Trend')}
        {trendStat(d.w14, '14-Tage-Trend')}
        {trendStat(d.w30, '30-Tage-Trend')}
        {prog && <Stat label="Ziel" value={`${prog.pct} %`} sub={`${fmt(prog.remainingKg, 1)} kg bis ${fmt(target, 1)} kg`} />}
        {fc && <Stat label="Prognose (Schätzung)" value={fc.etaDays != null ? `~${fc.etaDays} Tage` : '–'} sub={fc.etaDays != null ? `Bereich ${fc.etaLowDays ?? '?'}–${fc.etaHighDays ?? 'offen'} Tage (95 %)` : fc.reason} />}
      </Card>
      <Card>
        <CardTitle action={<Tabs value={range} onChange={setRange} items={[{ value: '30', label: '30 T' }, { value: '90', label: '90 T' }, { value: '365', label: '1 J' }, { value: 'all', label: 'Alle' }]} className="w-56" />}>Gewicht</CardTitle>
        <PointsWithTrend data={d.chart} pointKey="weight" trendKey="trend" pointLabel="Messung" trendLabel="Trend (EMA α 0,1)" unit="kg" refY={target ? { y: target, label: 'Ziel' } : undefined} />
        <p className="mt-1 text-[11px] text-muted">Trend = zeitgewichteter exponentieller gleitender Durchschnitt; Lücken werden nicht mit erfundenen Werten gefüllt.</p>
      </Card>
      <Card>
        <CardTitle>Körperfett</CardTitle>
        <LineSeriesChart
          data={d.bf}
          series={[
            { key: 'manual', label: 'Gemessen (manuell/Gerät)', color: SERIES.s1, unit: '%', dots: true, digits: 1 },
            { key: 'navy', label: 'Geschätzt (Navy)', color: SERIES.s2, unit: '%', dots: true, dashed: true, digits: 1 },
          ]}
        />
      </Card>
      <Card>
        <CardTitle>Fettmasse & fettfreie Masse (berechnet)</CardTitle>
        <LineSeriesChart
          data={d.comp}
          series={[
            { key: 'lean', label: 'Fettfreie Masse', color: SERIES.s1, unit: 'kg', dots: true, digits: 1 },
            { key: 'fat', label: 'Fettmasse', color: SERIES.s2, unit: 'kg', dots: true, digits: 1 },
          ]}
        />
      </Card>
      <Card>
        <CardTitle>Umfänge</CardTitle>
        <LineSeriesChart
          data={d.circ}
          series={[
            { key: 'waist', label: 'Taille', color: SERIES.s1, unit: 'cm', dots: true, digits: 1 },
            { key: 'abdomen', label: 'Bauch', color: SERIES.s2, unit: 'cm', dots: true, digits: 1 },
            { key: 'hip', label: 'Hüfte', color: SERIES.s3, unit: 'cm', dots: true, digits: 1 },
          ]}
        />
      </Card>
    </div>
  );
}

function MeasurementList({ onEdit }: { onEdit: (m: Measurement) => void }) {
  const ms = useMeasurements();
  if (!ms.length) return <Empty title="Keine Messungen" />;
  return (
    <Card>
      <ul className="divide-y" data-testid="measurement-list">
        {[...ms].reverse().map((m) => (
          <li key={m.id}>
            <button className="flex w-full items-center justify-between gap-2 py-3 text-left" onClick={() => onEdit(m)}>
              <div className="min-w-0">
                <div className="font-medium">{formatDate(m.date, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                <div className="truncate text-xs text-muted">
                  {MEASUREMENT_FIELDS.filter(([f]) => m[f] != null && f !== 'weightKg' && f !== 'bodyFatPct')
                    .map(([f, l, u]) => `${l} ${fmt(m[f], 1)} ${u}`)
                    .join(' · ')}
                  {m.custom && Object.entries(m.custom).map(([k, v]) => ` · ${k} ${v}`)}
                </div>
              </div>
              <div className="text-right">
                {m.weightKg != null && <div className="font-semibold tabular-nums">{fmt(m.weightKg, 1)} kg</div>}
                {m.bodyFatPct != null && (
                  <div className="text-xs">
                    {fmt(m.bodyFatPct, 1)} % <Badge tone={m.bodyFatMethod === 'navy' ? 'warn' : 'info'}>{m.bodyFatMethod === 'navy' ? 'Navy-Schätzung' : m.bodyFatMethod === 'device' ? 'Gerät' : 'gemessen'}</Badge>
                  </div>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const FORM_FIELDS = MEASUREMENT_FIELDS.filter(([f]) => f !== 'heightCm');

export function MeasurementForm({ initial, onClose, preset }: { initial?: Measurement; onClose: () => void; preset?: Partial<MeasurementInput> }) {
  const [m, setM] = useState<Partial<MeasurementInput>>(initial ? { ...initial } : { date: today(), ...preset });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState<number | undefined>();
  const save = async () => {
    try {
      await saveMeasurement(m as MeasurementInput, initial?.id);
      toast('Messung gespeichert', 'success');
      onClose();
    } catch (e) {
      if (e instanceof z.ZodError) setErrs(fieldErrors(e));
      toast(firstError(e), 'error');
    }
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={initial ? 'Messung bearbeiten' : 'Neue Messung'}
      footer={
        <>
          {initial && (
            <Button
              variant="danger"
              aria-label="Messung löschen"
              onClick={async () => {
                if (await confirmDialog({ title: 'Messung löschen?', text: 'Diese Messung wird endgültig entfernt.', danger: true, confirmLabel: 'Löschen' })) {
                  await deleteMeasurement(initial.id);
                  onClose();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button className="flex-1" onClick={save}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Messdatum" error={errs.date}>{(id) => <Input id={id} type="date" value={m.date ?? ''} onChange={(e) => setM({ ...m, date: e.target.value })} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          {FORM_FIELDS.map(([f, label, unit]) => (
            <Field key={f} label={`${label} (${unit})`} error={errs[f]}>
              {(id) => <NumberInput id={id} value={m[f]} onValue={(v) => setM({ ...m, [f]: v })} />}
            </Field>
          ))}
        </div>
        {m.bodyFatPct != null && (
          <Field label="Körperfett-Methode">
            {(id) => (
              <Select id={id} value={m.bodyFatMethod ?? 'manual'} onChange={(e) => setM({ ...m, bodyFatMethod: e.target.value as Measurement['bodyFatMethod'] })}>
                <option value="manual">Gemessen (z. B. Caliper, DEXA)</option>
                <option value="device">Gerät (Waage/BIA)</option>
                <option value="navy">Navy-Schätzung</option>
              </Select>
            )}
          </Field>
        )}
        <div>
          <div className="mb-1 text-xs font-medium text-muted">Eigene Messwerte</div>
          {Object.entries(m.custom ?? {}).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span>
                {k}: {v}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const c = { ...(m.custom ?? {}) };
                  delete c[k];
                  setM({ ...m, custom: c });
                }}
              >
                ✕
              </Button>
            </div>
          ))}
          <div className="mt-1 flex gap-2">
            <Input aria-label="Name eigener Messwert" placeholder="z. B. Wade (cm)" value={customKey} onChange={(e) => setCustomKey(e.target.value)} />
            <NumberInput aria-label="Wert eigener Messwert" className="w-28" value={customVal} onValue={setCustomVal} />
            <Button
              variant="secondary"
              onClick={() => {
                if (!customKey.trim() || customVal == null) return;
                setM({ ...m, custom: { ...(m.custom ?? {}), [customKey.trim()]: customVal } });
                setCustomKey('');
                setCustomVal(undefined);
              }}
            >
              +
            </Button>
          </div>
        </div>
        <Field label="Notiz">{(id) => <Textarea id={id} value={m.note ?? ''} onChange={(e) => setM({ ...m, note: e.target.value })} />}</Field>
      </div>
    </Sheet>
  );
}

function NavyCalculator() {
  const profile = useProfile();
  const ms = useMeasurements();
  const lastWeight = [...ms].reverse().find((m) => m.weightKg != null)?.weightKg;
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex ?? 'male');
  const profileSexApplied = useRef(!!profile);
  const [v, setV] = useState<{ heightCm?: number; neckCm?: number; waistCm?: number; hipCm?: number; weightKg?: number }>({ heightCm: profile?.heightCm, weightKg: lastWeight });
  const [result, setResult] = useState<{ pct: number; formula: string } | null>(null);
  const [err, setErr] = useState<string>();
  const navyMs = ms.filter((m) => m.bodyFatMethod === 'navy');
  // Profil/Messungen laden asynchron → Vorbelegung nachziehen, ohne Nutzereingaben zu überschreiben
  useEffect(() => {
    if (profile) {
      setV((cur) => ({ ...cur, heightCm: cur.heightCm ?? profile.heightCm }));
      setSex((cur) => (profileSexApplied.current ? cur : ((profileSexApplied.current = true), profile.sex)));
    }
  }, [profile]);
  useEffect(() => {
    if (lastWeight != null) setV((cur) => ({ ...cur, weightKg: cur.weightKg ?? lastWeight }));
  }, [lastWeight]);
  const calc = () => {
    try {
      const r = navyBodyFat({ sex, heightCm: v.heightCm!, neckCm: v.neckCm!, waistCm: v.waistCm!, hipCm: v.hipCm });
      setResult({ pct: r.bodyFatPct, formula: r.formula });
      setErr(undefined);
    } catch (e) {
      setResult(null);
      setErr(firstError(e));
    }
  };
  const save = async () => {
    if (!result) return;
    try {
      await saveMeasurement({ date: today(), bodyFatPct: result.pct, bodyFatMethod: 'navy', neckCm: v.neckCm, [sex === 'male' ? 'abdomenCm' : 'waistCm']: v.waistCm, hipCm: sex === 'female' ? v.hipCm : undefined, weightKg: v.weightKg, heightCm: v.heightCm } as MeasurementInput);
      toast('Navy-Ergebnis gespeichert', 'success');
    } catch (e) {
      toast(firstError(e), 'error');
    }
  };
  const fm = result && v.weightKg ? fatMass(v.weightKg, result.pct) : null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        <CardTitle>US-Navy-Umfangsmethode</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Formelvariante">
            {(id) => (
              <Select id={id} value={sex} onChange={(e) => setSex(e.target.value as 'male' | 'female')}>
                <option value="male">Männer (Bauch, Hals)</option>
                <option value="female">Frauen (Taille, Hüfte, Hals)</option>
              </Select>
            )}
          </Field>
          <Field label="Körpergröße (cm)">{(id) => <NumberInput id={id} value={v.heightCm} onValue={(x) => setV({ ...v, heightCm: x })} />}</Field>
          <Field label="Halsumfang (cm)">{(id) => <NumberInput id={id} value={v.neckCm} onValue={(x) => setV({ ...v, neckCm: x })} />}</Field>
          <Field label={sex === 'male' ? 'Bauchumfang (cm, Nabelhöhe)' : 'Taillenumfang (cm, schmalste Stelle)'}>{(id) => <NumberInput id={id} value={v.waistCm} onValue={(x) => setV({ ...v, waistCm: x })} />}</Field>
          {sex === 'female' && <Field label="Hüftumfang (cm, breiteste Stelle)">{(id) => <NumberInput id={id} value={v.hipCm} onValue={(x) => setV({ ...v, hipCm: x })} />}</Field>}
          <Field label="Gewicht (kg, für Fettmasse)">{(id) => <NumberInput id={id} value={v.weightKg} onValue={(x) => setV({ ...v, weightKg: x })} />}</Field>
        </div>
        {err && (
          <p role="alert" className="text-sm text-danger">
            {err}
          </p>
        )}
        <Button onClick={calc} className="w-full">
          Berechnen
        </Button>
        {result && (
          <div className="rounded-xl bg-fg/[0.04] p-3" data-testid="navy-result">
            <div className="text-3xl font-bold tabular-nums">{fmt(result.pct, 1)} %</div>
            <div className="text-xs text-muted">{result.formula} · Näherungswert</div>
            {fm && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Stat label="Fettmasse" value={fmt(fm.fatMassKg, 1)} unit="kg" />
                <Stat label="Fettfreie Masse" value={fmt(fm.leanMassKg, 1)} unit="kg" />
              </div>
            )}
            <Button className="mt-3 w-full" variant="secondary" onClick={save}>
              Ergebnis speichern
            </Button>
          </div>
        )}
      </Card>
      <div className="space-y-4">
        <Card>
          <CardTitle>
            <span className="flex items-center gap-1">
              <Info className="h-4 w-4" /> Messanleitung
            </span>
          </CardTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Morgens, nüchtern, entspannt stehen, normal ausatmen – nicht den Bauch einziehen.</li>
            <li>Maßband waagerecht, eng anliegend, ohne die Haut einzudrücken. Jeweils 2–3× messen, Mittelwert nehmen.</li>
            <li>Hals: direkt unterhalb des Kehlkopfs, Band leicht nach vorne abfallend.</li>
            <li>Männer – Bauch: auf Höhe des Bauchnabels.</li>
            <li>Frauen – Taille: an der schmalsten Stelle; Hüfte: an der breitesten Stelle des Gesäßes.</li>
          </ul>
          <p className="mt-2 text-xs text-warn">Die Navy-Methode ist eine Näherung (typische Abweichung ca. ±3–4 Prozentpunkte gegenüber Referenzverfahren). Sie eignet sich vor allem für Verläufe mit gleicher Messtechnik.</p>
        </Card>
        <Card>
          <CardTitle>Bisherige Navy-Messungen</CardTitle>
          {navyMs.length ? (
            <>
              <LineSeriesChart data={navyMs.map((m) => ({ date: m.date, bf: m.bodyFatPct }))} series={[{ key: 'bf', label: 'Körperfett (Navy)', color: SERIES.s2, unit: '%', dots: true, digits: 1 }]} height={160} />
              <ul className="mt-2 divide-y text-sm">
                {[...navyMs].reverse().map((m, i, arr) => {
                  const prev = arr[i + 1];
                  return (
                    <li key={m.id} className="flex justify-between py-1.5">
                      <span>{formatDate(m.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      <span className="tabular-nums">
                        {fmt(m.bodyFatPct, 1)} % {prev && <span className="text-xs text-muted">({m.bodyFatPct! - prev.bodyFatPct! > 0 ? '+' : ''}{fmt(m.bodyFatPct! - prev.bodyFatPct!, 1)})</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted">Noch keine gespeicherten Navy-Ergebnisse.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Compare() {
  const ms = useMeasurements();
  const [a, setA] = useState<string>(ms[0]?.id ?? '');
  const [b, setB] = useState<string>(ms[ms.length - 1]?.id ?? '');
  if (ms.length < 2) return <Empty title="Mindestens zwei Messungen nötig" />;
  const ma = ms.find((m) => m.id === a) ?? ms[0]!;
  const mb = ms.find((m) => m.id === b) ?? ms[ms.length - 1]!;
  const rows = compareMeasurements(ma, mb);
  const opt = (m: Measurement) => (
    <option key={m.id} value={m.id}>
      {formatDate(m.date, { day: '2-digit', month: '2-digit', year: 'numeric' })} {m.weightKg ? `· ${fmt(m.weightKg, 1)} kg` : ''}
    </option>
  );
  return (
    <Card>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label="Zeitpunkt A">
          {(id) => (
            <Select id={id} value={ma.id} onChange={(e) => setA(e.target.value)}>
              {ms.map(opt)}
            </Select>
          )}
        </Field>
        <Field label="Zeitpunkt B">
          {(id) => (
            <Select id={id} value={mb.id} onChange={(e) => setB(e.target.value)}>
              {ms.map(opt)}
            </Select>
          )}
        </Field>
      </div>
      <table className="w-full text-sm" data-testid="compare-table">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1">Messwert</th>
            <th className="py-1 text-right">A</th>
            <th className="py-1 text-right">B</th>
            <th className="py-1 text-right">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className="border-t">
              <td className="py-1.5">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums">{r.a == null ? '–' : `${fmt(r.a, 1)} ${r.unit}`}</td>
              <td className="py-1.5 text-right tabular-nums">{r.b == null ? '–' : `${fmt(r.b, 1)} ${r.unit}`}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{r.diff == null ? 'nicht vergleichbar' : `${r.diff > 0 ? '+' : ''}${fmt(r.diff, 1)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
