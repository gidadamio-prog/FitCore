// Diagramm-Bausteine (Recharts). Regeln: eine y-Achse pro Diagramm, 2px-Linien, dezentes Raster,
// Tooltip immer an, Legende ab 2 Serien, fehlende Werte = Lücke (connectNulls nur bei Trendlinien).
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceLine, ComposedChart, Scatter } from 'recharts';
import { useState } from 'react';
import { fmt } from './ui';

export const SERIES = {
  s1: 'rgb(var(--protein))', // Slot 1 – blau
  s2: 'rgb(var(--carbs))', // Slot 2 – orange
  s3: 'rgb(var(--fat))', // Slot 3 – aqua
  muted: 'rgb(var(--muted))',
};

const tooltipStyle = {
  contentStyle: { background: 'rgb(var(--card))', border: '1px solid rgb(var(--border))', borderRadius: 12, fontSize: 12, color: 'rgb(var(--fg))' },
  labelStyle: { color: 'rgb(var(--muted))' },
};

const shortDate = (d: string) => (d.length === 10 ? `${d.slice(8, 10)}.${d.slice(5, 7)}.` : d);

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
  unit?: string;
  dashed?: boolean;
  connect?: boolean;
  dots?: boolean;
  digits?: number;
}

export function LineSeriesChart({ data, x = 'date', series: allSeries, height = 220, refY, yDomain }: { data: Record<string, unknown>[]; x?: string; series: SeriesDef[]; height?: number; refY?: { y: number; label: string }; yDomain?: [number | string, number | string] }) {
  // Serien ohne einen einzigen Wert werden ausgeblendet (keine leeren Legendeneinträge)
  const withData = allSeries.filter((s) => data.some((d) => d[s.key] != null));
  const series = withData.length ? withData : allSeries;
  return (
    <ChartFrame data={data} series={series} x={x}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey={x} tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} domain={yDomain ?? ['auto', 'auto']} width={48} />
          <Tooltip {...tooltipStyle} labelFormatter={(l) => shortDate(String(l))} formatter={(v, n) => [fmtVal(v, series.find((s) => s.label === n)), n]} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />}
          {refY && <ReferenceLine y={refY.y} stroke={SERIES.muted} strokeDasharray="4 4" label={{ value: refY.label, position: 'insideTopRight', fontSize: 11, fill: 'rgb(var(--muted))' }} />}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} dot={s.dots ? { r: 4, strokeWidth: 2, stroke: 'rgb(var(--card))', fill: s.color } : false} activeDot={{ r: 5 }} connectNulls={s.connect ?? false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Messpunkte + Trendlinie in einem Diagramm (gleiche Einheit, eine Achse). */
export function PointsWithTrend({ data, pointKey, trendKey, pointLabel, trendLabel, unit, height = 220, refY }: { data: Record<string, unknown>[]; pointKey: string; trendKey: string; pointLabel: string; trendLabel: string; unit: string; height?: number; refY?: { y: number; label: string } }) {
  const series: SeriesDef[] = [
    { key: pointKey, label: pointLabel, color: SERIES.muted, unit, digits: 1 },
    { key: trendKey, label: trendLabel, color: SERIES.s1, unit, digits: 1 },
  ];
  return (
    <ChartFrame data={data} series={series} x="date">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} domain={['auto', 'auto']} width={48} />
          <Tooltip {...tooltipStyle} labelFormatter={(l) => shortDate(String(l))} formatter={(v, n) => [fmtVal(v, series.find((s) => s.label === n)), n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {refY && <ReferenceLine y={refY.y} stroke={SERIES.muted} strokeDasharray="4 4" label={{ value: refY.label, position: 'insideTopRight', fontSize: 11, fill: 'rgb(var(--muted))' }} />}
          <Scatter dataKey={pointKey} name={pointLabel} fill={SERIES.muted} shape="circle" isAnimationActive={false} />
          <Line type="monotone" dataKey={trendKey} name={trendLabel} stroke={SERIES.s1} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function BarSeriesChart({ data, x = 'date', series, height = 200, stacked, refY }: { data: Record<string, unknown>[]; x?: string; series: SeriesDef[]; height?: number; stacked?: boolean; refY?: { y: number; label: string } }) {
  return (
    <ChartFrame data={data} series={series} x={x}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={x} tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} width={48} />
          <Tooltip {...tooltipStyle} cursor={{ fill: 'rgb(var(--fg) / 0.05)' }} labelFormatter={(l) => shortDate(String(l))} formatter={(v, n) => [fmtVal(v, series.find((s) => s.label === n)), n]} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {refY && <ReferenceLine y={refY.y} stroke={SERIES.muted} strokeDasharray="4 4" label={{ value: refY.label, position: 'insideTopRight', fontSize: 11, fill: 'rgb(var(--muted))' }} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={stacked ? 'a' : undefined} radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]} stroke="rgb(var(--card))" strokeWidth={stacked ? 2 : 0} isAnimationActive={false} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function fmtVal(v: unknown, s?: SeriesDef) {
  if (v == null) return 'keine Daten';
  return `${fmt(Number(v), s?.digits ?? 0)}${s?.unit ? ' ' + s.unit : ''}`;
}

/** Rahmen mit umschaltbarer Tabellenansicht (Barrierefreiheit). */
function ChartFrame({ data, series, x, children }: { data: Record<string, unknown>[]; series: SeriesDef[]; x: string; children: React.ReactNode }) {
  const [table, setTable] = useState(false);
  const hasData = data.some((d) => series.some((s) => d[s.key] != null));
  if (!hasData) return <p className="py-8 text-center text-sm text-muted">Keine Daten im gewählten Zeitraum.</p>;
  return (
    <div>
      <div className="flex justify-end">
        <button className="text-[11px] text-muted underline" onClick={() => setTable((t) => !t)}>
          {table ? 'Diagramm' : 'Tabelle'}
        </button>
      </div>
      {table ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1">Datum</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1 text-right">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1">{shortDate(String(d[x]))}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1 text-right tabular-nums">
                      {d[s.key] == null ? '–' : fmtVal(d[s.key], s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
