import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Field, NumberInput, Select, cn, fmt } from '@/components/ui';
import { GOAL_LABELS, macroConsistency } from '@/domain/energy';
import type { BmrFormula, GoalType, GoalVersion, MacroStrategy, Profile } from '@/domain/types';
import { addGoalVersion, deriveGoal } from '@/data/profileRepo';
import { manualTargetsSchema, firstError } from '@/domain/schemas';
import { toast } from '@/stores/ui';
import { formatDate } from '@/domain/dates';

export const STRATEGY_LABELS: Record<MacroStrategy, string> = {
  balanced: 'Ausgewogen',
  low_carb: 'Weniger Kohlenhydrate',
  high_carb: 'Mehr Kohlenhydrate',
  high_protein: 'Proteinbetont',
};

export function GoalWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <ul className="space-y-1">
      {warnings.map((w) => (
        <li key={w} className="flex gap-2 text-xs text-warn">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {w}
        </li>
      ))}
    </ul>
  );
}

export function GoalEditor({ profile, current, weightKg }: { profile: Profile; current: GoalVersion; weightKg: number | undefined }) {
  const [choice, setChoice] = useState<{ primaryGoal: GoalType; secondaryGoals: GoalType[]; weeklyRateKg: number; macroStrategy: MacroStrategy; formula: BmrFormula }>({
    primaryGoal: current.primaryGoal,
    secondaryGoals: current.secondaryGoals,
    weeklyRateKg: current.weeklyRateKg,
    macroStrategy: current.macroStrategy,
    formula: current.formula,
  });
  const [manual, setManual] = useState({ calorieTarget: current.calorieTarget, proteinG: current.proteinG, carbsG: current.carbsG, fatG: current.fatG });
  const [mode, setMode] = useState<'auto' | 'manual'>(current.manualCalories || current.manualMacros ? 'manual' : 'auto');

  const computed = useMemo(() => {
    if (!weightKg) return null;
    try {
      return deriveGoal(profile, weightKg, choice);
    } catch (e) {
      return { error: firstError(e) } as const;
    }
  }, [profile, weightKg, choice]);
  const consistency = macroConsistency(manual.calorieTarget || 0, manual.proteinG || 0, manual.carbsG || 0, manual.fatG || 0);

  const save = async () => {
    if (!computed || 'error' in computed) return;
    try {
      if (mode === 'manual') manualTargetsSchema.parse(manual);
      await addGoalVersion({
        primaryGoal: choice.primaryGoal,
        secondaryGoals: choice.secondaryGoals,
        weeklyRateKg: computed.weeklyRateKg,
        macroStrategy: choice.macroStrategy,
        formula: computed.formula,
        bmr: computed.bmr,
        tdee: computed.tdee,
        adjustmentKcal: mode === 'manual' ? manual.calorieTarget - computed.tdee : computed.adjustmentKcal,
        calorieTarget: mode === 'manual' ? manual.calorieTarget : computed.calorieTarget,
        proteinG: mode === 'manual' ? manual.proteinG : computed.proteinG,
        carbsG: mode === 'manual' ? manual.carbsG : computed.carbsG,
        fatG: mode === 'manual' ? manual.fatG : computed.fatG,
        manualCalories: mode === 'manual' && manual.calorieTarget !== computed.calorieTarget,
        manualMacros: mode === 'manual',
        reason: mode === 'manual' ? 'Manuelle Anpassung' : 'Ziel neu berechnet',
      });
      toast('Neue Zielversion gespeichert – gilt ab heute, frühere Tage bleiben unverändert.', 'success');
    } catch (e) {
      toast(firstError(e), 'error');
    }
  };

  return (
    <Card className="space-y-4">
      <CardTitle>Ziele & Kalorienrechner</CardTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Hauptziel">
          {(id) => (
            <Select id={id} value={choice.primaryGoal} onChange={(e) => setChoice((c) => ({ ...c, primaryGoal: e.target.value as GoalType }))}>
              {Object.entries(GOAL_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Veränderung kg/Woche" hint="negativ = Abnahme">
          {(id) => <NumberInput id={id} step={0.1} value={choice.weeklyRateKg} onValue={(v) => setChoice((c) => ({ ...c, weeklyRateKg: v ?? 0 }))} />}
        </Field>
        <Field label="Makro-Strategie">
          {(id) => (
            <Select id={id} value={choice.macroStrategy} onChange={(e) => setChoice((c) => ({ ...c, macroStrategy: e.target.value as MacroStrategy }))}>
              {Object.entries(STRATEGY_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Formel">
          {(id) => (
            <Select id={id} value={choice.formula} onChange={(e) => setChoice((c) => ({ ...c, formula: e.target.value as BmrFormula }))}>
              <option value="mifflin">Mifflin-St Jeor</option>
              <option value="katch" disabled={profile.bodyFatPct == null}>
                Katch-McArdle
              </option>
            </Select>
          )}
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(GOAL_LABELS) as GoalType[])
          .filter((g) => g !== choice.primaryGoal)
          .map((g) => {
            const on = choice.secondaryGoals.includes(g);
            return (
              <button key={g} type="button" aria-pressed={on} onClick={() => setChoice((s) => ({ ...s, secondaryGoals: on ? s.secondaryGoals.filter((x) => x !== g) : [...s.secondaryGoals, g] }))} className={cn('h-8 rounded-full border px-3 text-xs', on ? 'border-accent bg-accent/10 text-accent' : 'text-muted')}>
                {GOAL_LABELS[g]}
              </button>
            );
          })}
      </div>
      {!weightKg && <p className="text-sm text-warn">Bitte zuerst ein Körpergewicht erfassen.</p>}
      {computed && 'error' in computed && <p className="text-sm text-danger">{computed.error}</p>}
      {computed && !('error' in computed) && (
        <div className="space-y-1 rounded-xl bg-fg/[0.04] p-3 text-sm" data-testid="calc-breakdown">
          <div className="flex justify-between">
            <span className="text-muted">Formel</span>
            <span>{computed.formula === 'katch' ? 'Katch-McArdle (370 + 21,6 × FFM)' : 'Mifflin-St Jeor (10·kg + 6,25·cm − 5·Alter ' + (profile.sex === 'male' ? '+ 5' : '− 161') + ')'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Grundumsatz</span>
            <span data-testid="calc-bmr">{fmt(computed.bmr)} kcal</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Gesamtbedarf (Aktivitätsfaktor)</span>
            <span data-testid="calc-tdee">{fmt(computed.tdee)} kcal</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">{computed.adjustmentKcal < 0 ? 'Defizit' : 'Überschuss'}</span>
            <span>
              {computed.adjustmentKcal > 0 ? '+' : ''}
              {fmt(computed.adjustmentKcal)} kcal
            </span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Berechnetes Kalorienziel</span>
            <span>{fmt(computed.calorieTarget)} kcal</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Makros (P/KH/F)</span>
            <span>
              {computed.proteinG} / {computed.carbsG} / {computed.fatG} g
            </span>
          </div>
          <GoalWarnings warnings={computed.warnings} />
        </div>
      )}
      <div className="flex gap-2">
        <Button variant={mode === 'auto' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('auto')}>
          Berechnete Werte
        </Button>
        <Button variant={mode === 'manual' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('manual')}>
          Manuell überschreiben
        </Button>
      </div>
      {mode === 'manual' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="kcal">{(id) => <NumberInput id={id} value={manual.calorieTarget} onValue={(v) => setManual((m) => ({ ...m, calorieTarget: v ?? 0 }))} />}</Field>
            <Field label="Protein g">{(id) => <NumberInput id={id} value={manual.proteinG} onValue={(v) => setManual((m) => ({ ...m, proteinG: v ?? 0 }))} />}</Field>
            <Field label="KH g">{(id) => <NumberInput id={id} value={manual.carbsG} onValue={(v) => setManual((m) => ({ ...m, carbsG: v ?? 0 }))} />}</Field>
            <Field label="Fett g">{(id) => <NumberInput id={id} value={manual.fatG} onValue={(v) => setManual((m) => ({ ...m, fatG: v ?? 0 }))} />}</Field>
          </div>
          <p className={cn('text-xs', consistency.consistent ? 'text-muted' : 'text-warn')} data-testid="macro-consistency">
            Makro-Summe: {fmt(consistency.sum)} kcal ({consistency.diff > 0 ? '+' : ''}
            {consistency.diff} kcal zum Ziel) {consistency.consistent ? '✓ stimmig' : '– weicht vom Kalorienziel ab'}
          </p>
        </div>
      )}
      <Button onClick={save} disabled={!computed || 'error' in computed}>
        Als neues Ziel speichern
      </Button>
    </Card>
  );
}

export function GoalHistory({ goals }: { goals: GoalVersion[] }) {
  const sorted = [...goals].sort((a, b) => (b.effectiveFrom + String(b.id).padStart(8, '0')).localeCompare(a.effectiveFrom + String(a.id).padStart(8, '0')));
  return (
    <Card>
      <CardTitle>Zielhistorie</CardTitle>
      <ul className="divide-y text-sm">
        {sorted.map((g, i) => (
          <li key={g.id} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <div className="font-medium">
                ab {formatDate(g.effectiveFrom, { day: '2-digit', month: '2-digit', year: 'numeric' })} · {GOAL_LABELS[g.primaryGoal]}
              </div>
              <div className="text-xs text-muted">
                {g.reason} · P {g.proteinG} / KH {g.carbsG} / F {g.fatG} g
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold tabular-nums">{fmt(g.calorieTarget)} kcal</div>
              {i === 0 && <Badge tone="accent">aktuell</Badge>}
              {g.manualMacros && <Badge>manuell</Badge>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
