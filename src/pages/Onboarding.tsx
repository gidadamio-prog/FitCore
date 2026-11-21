import { useMemo, useState } from 'react';
import { z } from 'zod';
import { Button, Card, Field, Input, NumberInput, Select, cn, fmt } from '@/components/ui';
import { profileSchema, fieldErrors, type ProfileForm } from '@/domain/schemas';
import { ACTIVITY_LABELS, GOAL_LABELS, defaultWeeklyRate } from '@/domain/energy';
import { completeOnboarding, deriveGoal } from '@/data/profileRepo';
import { EQUIPMENT } from '@/data/exerciseLibrary';
import type { ActivityLevel, BmrFormula, GoalType, MacroStrategy } from '@/domain/types';
import { toast } from '@/stores/ui';
import { GoalWarnings, STRATEGY_LABELS } from './goalShared';
import { restoreBackup } from '@/data/backup';
import { firstError } from '@/domain/schemas';

const STEPS = ['Über dich', 'Aktivität', 'Situation', 'Ziele'];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<ProfileForm>>({
    activityLevel: 'light',
    experience: 'beginner',
    trainingDaysPerWeek: 3,
    dietPreference: 'Keine Einschränkung',
    equipment: [],
    specialSituation: 'none',
  });
  const [goal, setGoal] = useState<{ primaryGoal: GoalType; secondaryGoals: GoalType[]; weeklyRateKg?: number; macroStrategy: MacroStrategy; formula: BmrFormula }>({
    primaryGoal: 'lose_weight',
    secondaryGoals: [],
    macroStrategy: 'balanced',
    formula: 'mifflin',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K] | undefined) => setForm((f) => ({ ...f, [k]: v }));

  const stepFields: (keyof ProfileForm)[][] = [
    ['name', 'birthDate', 'sex', 'heightCm', 'weightKg'],
    ['activityLevel', 'experience', 'trainingDaysPerWeek', 'bodyFatPct', 'dietPreference', 'equipment'],
    ['specialSituation'],
    ['targetWeightKg'],
  ];

  const validateStep = () => {
    const r = profileSchema.safeParse(form);
    if (r.success) {
      setErrors({});
      return true;
    }
    const all = fieldErrors(r.error);
    const relevant: Record<string, string> = {};
    for (const k of stepFields.slice(0, step + 1).flat()) if (all[k]) relevant[k] = all[k]!;
    setErrors(relevant);
    return Object.keys(relevant).length === 0;
  };

  const preview = useMemo(() => {
    const r = profileSchema.safeParse(form);
    if (!r.success) return null;
    try {
      return deriveGoal({ ...r.data }, r.data.weightKg, goal);
    } catch {
      return null;
    }
  }, [form, goal]);

  const finish = async () => {
    if (!validateStep()) return;
    setBusy(true);
    try {
      await completeOnboarding(profileSchema.parse(form), goal);
      toast('Profil angelegt – willkommen bei FitCore!', 'success');
    } catch (e) {
      if (e instanceof z.ZodError) setErrors(fieldErrors(e));
      toast(e instanceof Error ? e.message : 'Fehler beim Speichern', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-6">
      <div className="mb-6">
        <div className="text-2xl font-bold tracking-tight">
          Fit<span className="text-accent">Core</span>
        </div>
        <p className="text-sm text-muted">Ernährung, Training und Körper in einem System. Alle Daten bleiben auf diesem Gerät.</p>
      </div>
      <ol className="mb-4 grid grid-cols-4 gap-2" aria-label="Fortschritt">
        {STEPS.map((s, i) => (
          <li key={s} className="space-y-1">
            <div className={cn('h-1.5 rounded-full', i <= step ? 'bg-accent' : 'bg-fg/10')} />
            <div className={cn('text-[11px]', i === step ? 'font-medium' : 'text-muted')}>{s}</div>
          </li>
        ))}
      </ol>
      <Card className="space-y-4">
        {step === 0 && (
          <>
            <Field label="Name" error={errors.name}>{(id) => <Input id={id} value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} autoComplete="given-name" />}</Field>
            <Field label="Geburtsdatum" error={errors.birthDate}>{(id) => <Input id={id} type="date" value={form.birthDate ?? ''} onChange={(e) => set('birthDate', e.target.value)} />}</Field>
            <Field label="Geschlecht (für die Energie- und Körperfettformeln)" error={errors.sex}>
              {(id) => (
                <Select id={id} value={form.sex ?? ''} onChange={(e) => set('sex', (e.target.value || undefined) as ProfileForm['sex'])}>
                  <option value="">Bitte wählen</option>
                  <option value="male">männlich</option>
                  <option value="female">weiblich</option>
                </Select>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Größe (cm)" error={errors.heightCm}>{(id) => <NumberInput id={id} value={form.heightCm} onValue={(v) => set('heightCm', v)} />}</Field>
              <Field label="Gewicht (kg)" error={errors.weightKg}>{(id) => <NumberInput id={id} value={form.weightKg} onValue={(v) => set('weightKg', v)} />}</Field>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <Field label="Aktivitätsniveau im Alltag" hint="Am besten ohne gezieltes Training wählen – Training wird separat angerechnet." error={errors.activityLevel}>
              {(id) => (
                <Select id={id} value={form.activityLevel} onChange={(e) => set('activityLevel', e.target.value as ActivityLevel)}>
                  {Object.entries(ACTIVITY_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Trainingserfahrung">
                {(id) => (
                  <Select id={id} value={form.experience} onChange={(e) => set('experience', e.target.value as ProfileForm['experience'])}>
                    <option value="beginner">Einsteiger</option>
                    <option value="intermediate">Fortgeschritten</option>
                    <option value="advanced">Erfahren</option>
                  </Select>
                )}
              </Field>
              <Field label="Trainings/Woche" error={errors.trainingDaysPerWeek}>{(id) => <NumberInput id={id} value={form.trainingDaysPerWeek} onValue={(v) => set('trainingDaysPerWeek', v)} />}</Field>
            </div>
            <Field label="Körperfettanteil in % (optional)" error={errors.bodyFatPct}>{(id) => <NumberInput id={id} value={form.bodyFatPct} onValue={(v) => set('bodyFatPct', v)} />}</Field>
            <Field label="Ernährungspräferenz">
              {(id) => (
                <Select id={id} value={form.dietPreference} onChange={(e) => set('dietPreference', e.target.value)}>
                  {['Keine Einschränkung', 'Vegetarisch', 'Vegan', 'Pescetarisch', 'Low Carb', 'Andere'].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              )}
            </Field>
            <div>
              <div className="mb-1 text-xs font-medium text-muted">Verfügbares Equipment</div>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT.map((e) => {
                  const on = form.equipment?.includes(e);
                  return (
                    <button key={e} type="button" aria-pressed={on} onClick={() => set('equipment', on ? form.equipment!.filter((x) => x !== e) : [...(form.equipment ?? []), e])} className={cn('h-9 rounded-full border px-3 text-sm', on ? 'border-accent bg-accent/10 text-accent' : 'text-muted')}>
                      {e}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <p className="text-sm text-muted">Gibt es eine besondere Situation? In diesen Fällen berechnet FitCore keine automatischen Abnehmvorgaben.</p>
            <Field label="Besondere Situation">
              {(id) => (
                <Select id={id} value={form.specialSituation} onChange={(e) => set('specialSituation', e.target.value as ProfileForm['specialSituation'])}>
                  <option value="none">Keine</option>
                  <option value="pregnant">Schwangerschaft</option>
                  <option value="breastfeeding">Stillzeit</option>
                  <option value="medical">Medizinische Gründe / ärztliche Ernährungsvorgaben</option>
                </Select>
              )}
            </Field>
            {form.specialSituation !== 'none' && <p className="rounded-xl bg-warn/10 p-3 text-sm text-warn">Automatische Kaloriendefizite sind deaktiviert. Bitte stimme Ziele mit deiner Ärztin/deinem Arzt oder einer Ernährungsfachkraft ab.</p>}
          </>
        )}
        {step === 3 && (
          <>
            <Field label="Hauptziel">
              {(id) => (
                <Select id={id} value={goal.primaryGoal} onChange={(e) => setGoal((g) => ({ ...g, primaryGoal: e.target.value as GoalType, weeklyRateKg: undefined }))}>
                  {Object.entries(GOAL_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div>
              <div className="mb-1 text-xs font-medium text-muted">Nebenziele</div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(GOAL_LABELS) as GoalType[])
                  .filter((g) => g !== goal.primaryGoal)
                  .map((g) => {
                    const on = goal.secondaryGoals.includes(g);
                    return (
                      <button key={g} type="button" aria-pressed={on} onClick={() => setGoal((s) => ({ ...s, secondaryGoals: on ? s.secondaryGoals.filter((x) => x !== g) : [...s.secondaryGoals, g] }))} className={cn('h-9 rounded-full border px-3 text-sm', on ? 'border-accent bg-accent/10 text-accent' : 'text-muted')}>
                        {GOAL_LABELS[g]}
                      </button>
                    );
                  })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Veränderung kg/Woche" hint={form.weightKg ? `Vorschlag: ${defaultWeeklyRate(goal.primaryGoal, form.weightKg)}` : undefined}>
                {(id) => <NumberInput id={id} value={goal.weeklyRateKg ?? (form.weightKg ? defaultWeeklyRate(goal.primaryGoal, form.weightKg) : undefined)} onValue={(v) => setGoal((g) => ({ ...g, weeklyRateKg: v }))} step={0.1} />}
              </Field>
              <Field label="Zielgewicht (optional)" error={errors.targetWeightKg}>{(id) => <NumberInput id={id} value={form.targetWeightKg} onValue={(v) => set('targetWeightKg', v)} />}</Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Makro-Strategie">
                {(id) => (
                  <Select id={id} value={goal.macroStrategy} onChange={(e) => setGoal((g) => ({ ...g, macroStrategy: e.target.value as MacroStrategy }))}>
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
                  <Select id={id} value={goal.formula} onChange={(e) => setGoal((g) => ({ ...g, formula: e.target.value as BmrFormula }))}>
                    <option value="mifflin">Mifflin-St Jeor</option>
                    <option value="katch" disabled={form.bodyFatPct == null}>
                      Katch-McArdle (braucht KF%)
                    </option>
                  </Select>
                )}
              </Field>
            </div>
            {preview ? (
              <div className="space-y-2 rounded-xl bg-fg/[0.04] p-3 text-sm" data-testid="goal-preview">
                <Row label={`Grundumsatz (${preview.formula === 'katch' ? 'Katch-McArdle' : 'Mifflin-St Jeor'})`} value={`${fmt(preview.bmr)} kcal`} />
                <Row label="Gesamtbedarf (geschätzt)" value={`${fmt(preview.tdee)} kcal`} />
                <Row label={preview.adjustmentKcal < 0 ? 'Defizit' : 'Überschuss'} value={`${preview.adjustmentKcal > 0 ? '+' : ''}${fmt(preview.adjustmentKcal)} kcal`} />
                <Row label="Kalorienziel" value={<b data-testid="preview-target">{fmt(preview.calorieTarget)} kcal</b>} />
                <Row label="Protein / KH / Fett" value={`${preview.proteinG} / ${preview.carbsG} / ${preview.fatG} g`} />
                <GoalWarnings warnings={preview.warnings} />
              </div>
            ) : (
              <p className="text-sm text-danger">Bitte prüfe die Angaben in den vorherigen Schritten.</p>
            )}
          </>
        )}
      </Card>
      <div className="mt-4 flex gap-2">
        {step > 0 && (
          <Button variant="secondary" className="flex-1" onClick={() => setStep((s) => s - 1)}>
            Zurück
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1" onClick={() => validateStep() && setStep((s) => s + 1)}>
            Weiter
          </Button>
        ) : (
          <Button className="flex-1" disabled={busy || !preview} onClick={finish}>
            Profil anlegen
          </Button>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted">Alle Berechnungen sind Schätzungen und ersetzen keine medizinische Beratung.</p>
      <label className="mt-4 block text-center text-sm text-accent underline">
        Vorhandenes FitCore-Backup wiederherstellen
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          data-testid="onboarding-restore"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const r = await restoreBackup(JSON.parse(await file.text()));
              toast(`Backup wiederhergestellt (${r.counts.diary ?? 0} Tagebucheinträge)`, 'success');
            } catch (err) {
              toast('Backup ungültig: ' + firstError(err), 'error');
            }
          }}
        />
      </label>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}
