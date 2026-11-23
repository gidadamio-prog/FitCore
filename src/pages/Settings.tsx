import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Upload, Trash2, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Field, Input, NumberInput, Select, Switch, Tabs, fmt } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { useGoals, useMeals, useMeasurements, useProfile, useSettings } from '@/hooks/data';
import { DEFAULT_MEAL_SPLIT, effectiveSplit, splitKcal } from '@/domain/nutrition';
import { setSetting, updateProfile } from '@/data/profileRepo';
import { download, diaryCSV, exportBackup, measurementsCSV, restoreBackup, wipeAllData, workoutsCSV } from '@/data/backup';
import { db } from '@/data/db';
import { goalForDate } from '@/domain/balance';
import { today, uid } from '@/domain/dates';
import { confirmDialog, toast } from '@/stores/ui';
import { firstError } from '@/domain/schemas';
import { ACTIVITY_LABELS } from '@/domain/energy';
import type { ActivityLevel, Profile } from '@/domain/types';
import { GoalEditor, GoalHistory } from './goalShared';
import { EQUIPMENT, GYMS } from '@/data/exerciseLibrary';
import { openFoodFacts, usdaFoodData } from '@/data/foodProviders';
import { InstallPrompt } from '@/components/InstallPrompt';
import { APP_VERSION, forceAppUpdate } from '@/components/Boot';

type Tab = 'profile' | 'goals' | 'energy' | 'app' | 'data';

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const profile = useProfile();
  if (!profile) return null;
  return (
    <div className="space-y-4">
      <PageHeader title="Einstellungen & Profil" />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'profile', label: 'Profil' }, { value: 'goals', label: 'Ziele' }, { value: 'energy', label: 'Energie' }, { value: 'app', label: 'App' }, { value: 'data', label: 'Daten' }]} />
      {tab === 'profile' && <ProfileForm profile={profile} />}
      {tab === 'goals' && <Goals profile={profile} />}
      {tab === 'energy' && <EnergySettings profile={profile} />}
      {tab === 'app' && <AppSettingsView />}
      {tab === 'data' && <DataSettings />}
    </div>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const [p, setP] = useState(profile);
  useEffect(() => setP(profile), [profile]);
  const save = async () => {
    try {
      await updateProfile({ name: p.name, birthDate: p.birthDate, sex: p.sex, heightCm: p.heightCm, activityLevel: p.activityLevel, experience: p.experience, trainingDaysPerWeek: p.trainingDaysPerWeek, bodyFatPct: p.bodyFatPct, dietPreference: p.dietPreference, equipment: p.equipment, specialSituation: p.specialSituation, targetWeightKg: p.targetWeightKg });
      toast('Profil gespeichert. Ziele unter „Ziele“ neu berechnen, falls gewünscht.', 'success');
    } catch (e) {
      toast(firstError(e), 'error');
    }
  };
  return (
    <Card className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">{(id) => <Input id={id} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />}</Field>
        <Field label="Geburtsdatum">{(id) => <Input id={id} type="date" value={p.birthDate} onChange={(e) => setP({ ...p, birthDate: e.target.value })} />}</Field>
        <Field label="Geschlecht (Formeln)">
          {(id) => (
            <Select id={id} value={p.sex} onChange={(e) => setP({ ...p, sex: e.target.value as Profile['sex'] })}>
              <option value="male">männlich</option>
              <option value="female">weiblich</option>
            </Select>
          )}
        </Field>
        <Field label="Körpergröße (cm)">{(id) => <NumberInput id={id} value={p.heightCm} onValue={(v) => setP({ ...p, heightCm: v ?? NaN })} />}</Field>
        <Field label="Aktivitätsniveau">
          {(id) => (
            <Select id={id} value={p.activityLevel} onChange={(e) => setP({ ...p, activityLevel: e.target.value as ActivityLevel })}>
              {Object.entries(ACTIVITY_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Erfahrung">
          {(id) => (
            <Select id={id} value={p.experience} onChange={(e) => setP({ ...p, experience: e.target.value as Profile['experience'] })}>
              <option value="beginner">Einsteiger</option>
              <option value="intermediate">Fortgeschritten</option>
              <option value="advanced">Erfahren</option>
            </Select>
          )}
        </Field>
        <Field label="Trainings pro Woche">{(id) => <NumberInput id={id} value={p.trainingDaysPerWeek} onValue={(v) => setP({ ...p, trainingDaysPerWeek: v ?? 0 })} />}</Field>
        <Field label="Körperfett % (optional)">{(id) => <NumberInput id={id} value={p.bodyFatPct} onValue={(v) => setP({ ...p, bodyFatPct: v })} />}</Field>
        <Field label="Zielgewicht kg (optional)">{(id) => <NumberInput id={id} value={p.targetWeightKg} onValue={(v) => setP({ ...p, targetWeightKg: v })} />}</Field>
        <Field label="Ernährungspräferenz">{(id) => <Input id={id} value={p.dietPreference} onChange={(e) => setP({ ...p, dietPreference: e.target.value })} />}</Field>
        <Field label="Besondere Situation">
          {(id) => (
            <Select id={id} value={p.specialSituation} onChange={(e) => setP({ ...p, specialSituation: e.target.value as Profile['specialSituation'] })}>
              <option value="none">Keine</option>
              <option value="pregnant">Schwangerschaft</option>
              <option value="breastfeeding">Stillzeit</option>
              <option value="medical">Medizinische Gründe</option>
            </Select>
          )}
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        {EQUIPMENT.map((e) => {
          const on = p.equipment.includes(e);
          return (
            <button key={e} type="button" aria-pressed={on} onClick={() => setP({ ...p, equipment: on ? p.equipment.filter((x) => x !== e) : [...p.equipment, e] })} className={`h-8 rounded-full border px-3 text-xs ${on ? 'border-accent bg-accent/10 text-accent' : 'text-muted'}`}>
              {e}
            </button>
          );
        })}
      </div>
      <Button onClick={save}>Profil speichern</Button>
    </Card>
  );
}

function Goals({ profile }: { profile: Profile }) {
  const goals = useGoals();
  const ms = useMeasurements();
  const weight = [...ms].reverse().find((m) => m.weightKg != null)?.weightKg;
  const current = goalForDate(goals, today());
  return (
    <div className="space-y-4">
      {current && <GoalEditor key={current.id} profile={profile} current={current} weightKg={weight} />}
      <MealSplitCard dailyKcal={current?.calorieTarget ?? null} />
      <GoalHistory goals={goals} />
    </div>
  );
}

function MealSplitCard({ dailyKcal }: { dailyKcal: number | null }) {
  const s = useSettings();
  const meals = useMeals();
  const shares = effectiveSplit(meals.map((m) => m.id), s.mealSplit);
  const sum = shares.reduce((a, x) => a + x.pct, 0);
  const kcal = dailyKcal != null ? splitKcal(dailyKcal, shares) : null;
  const setPct = (id: string, v: number | undefined) => {
    const next = { ...Object.fromEntries(shares.map((x) => [x.id, x.pct])), [id]: v == null ? 0 : Math.max(0, Math.min(100, Math.round(v))) };
    setSetting('mealSplit', next);
  };
  return (
    <Card className="space-y-3" data-testid="meal-split">
      <CardTitle>Kalorien je Mahlzeit</CardTitle>
      <p className="text-xs text-muted">
        Anteil des Tagesziels pro Mahlzeit. Die kcal-Ziele ergeben zusammen immer genau dein Tagesziel; an Trainingstagen werden die angerechneten kcal mit aufgeteilt. Isst du bei einer Mahlzeit mehr oder weniger, passen sich die noch offenen an.
      </p>
      <ul className="space-y-2">
        {meals.map((m) => {
          const x = shares.find((y) => y.id === m.id);
          return (
            <li key={m.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{m.label}</span>
              <div className="w-20">
                <NumberInput aria-label={`Anteil ${m.label} in Prozent`} min={0} max={100} step={1} value={x?.pct ?? 0} onValue={(v) => setPct(m.id, v)} />
              </div>
              <span className="w-4 text-sm text-muted">%</span>
              <span className="w-20 text-right text-sm tabular-nums text-muted" data-testid={`split-kcal-${m.id}`}>
                {kcal ? `${fmt(kcal.get(m.id) ?? 0)} kcal` : '–'}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className={sum === 100 ? 'text-muted' : 'text-warn'} data-testid="split-sum">
          Summe {fmt(sum)} %{sum !== 100 && sum > 0 && ' – wird anteilig auf 100 % umgerechnet'}
          {sum === 0 && ' – wird gleichmäßig verteilt'}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setSetting('mealSplit', { ...DEFAULT_MEAL_SPLIT })}>
          Standard
        </Button>
      </div>
    </Card>
  );
}

function EnergySettings({ profile }: { profile: Profile }) {
  const presets = [0, 25, 50, 75, 100];
  const [custom, setCustom] = useState<number | undefined>(presets.includes(profile.trainingCreditPct) ? undefined : profile.trainingCreditPct);
  const [included, setIncluded] = useState<number | undefined>(profile.includedTrainingKcal);
  const set = (patch: Partial<Profile>) => updateProfile(patch).catch((e) => toast(firstError(e), 'error'));
  return (
    <Card className="space-y-4">
      <CardTitle>Trainingskalorien anrechnen</CardTitle>
      <p className="text-sm text-muted">Geschätzte Trainingsenergie erhöht dein Tagesbudget um den gewählten Anteil. Schätzungen sind ungenau – viele starten mit 50 %.</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Anrechnungsquote">
        {presets.map((p) => (
          <Button key={p} size="sm" role="radio" aria-checked={profile.trainingCreditPct === p && custom === undefined} variant={profile.trainingCreditPct === p && custom === undefined ? 'primary' : 'secondary'} onClick={() => { setCustom(undefined); set({ trainingCreditPct: p }); }}>
            {p === 0 ? 'Keine' : `${p} %`}
          </Button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <Field label="Benutzerdefinierte Quote (%)" className="flex-1">{(id) => <NumberInput id={id} value={custom} onValue={setCustom} />}</Field>
        <Button variant="secondary" onClick={() => custom != null && (custom >= 0 && custom <= 100 ? set({ trainingCreditPct: Math.round(custom) }) : toast('Quote muss zwischen 0 und 100 % liegen.', 'error'))}>
          Übernehmen
        </Button>
      </div>
      <div className="text-sm">
        Aktuell: <b data-testid="credit-pct">{profile.trainingCreditPct} %</b>
      </div>
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Training ist bereits im Aktivitätsfaktor enthalten</div>
            <div className="text-xs text-muted">Verhindert doppelte Anrechnung, wenn du ein höheres Aktivitätsniveau wegen deines Trainings gewählt hast.</div>
          </div>
          <Switch label="Training im Aktivitätsfaktor" checked={profile.activityIncludesTraining} onChange={(v) => set({ activityIncludesTraining: v, includedTrainingKcal: v && !profile.includedTrainingKcal ? 300 : profile.includedTrainingKcal })} />
        </div>
        {profile.activityIncludesTraining && (
          <div className="flex items-end gap-2">
            <Field label="Bereits enthaltene kcal pro Trainingstag" className="flex-1" hint="Nur Trainingsenergie oberhalb dieses Werts wird angerechnet.">
              {(id) => <NumberInput id={id} value={included} onValue={setIncluded} />}
            </Field>
            <Button variant="secondary" onClick={() => included != null && included >= 0 && included <= 3000 && set({ includedTrainingKcal: Math.round(included) })}>
              Speichern
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function AppSettingsView() {
  const s = useSettings();
  const [meal, setMeal] = useState('');
  const [key, setKey] = useState(s.usdaApiKey);
  useEffect(() => setKey(s.usdaApiKey), [s.usdaApiKey]);
  return (
    <div className="space-y-4">
      <InstallPrompt always />
      <Card className="space-y-3">
        <CardTitle>Darstellung</CardTitle>
        <Tabs value={s.theme} onChange={(t) => setSetting('theme', t)} items={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }]} />
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Animationen reduzieren</div>
            <div className="text-xs text-muted">Schaltet Effekte, Partikel und Bewegungen ab (spart auch Akku).</div>
          </div>
          <Switch label="Animationen reduzieren" checked={s.reduceMotion} onChange={(v) => setSetting('reduceMotion', v)} />
        </div>
      </Card>
      <Card className="space-y-3">
        <CardTitle>Mein Studio</CardTitle>
        <Field label="Heimstudio" hint="Übungsauswahl und Vorlagen zeigen dann zuerst die Geräte dieses Studios.">
          {(id) => (
            <Select id={id} value={s.homeGym} onChange={(e) => setSetting('homeGym', e.target.value)}>
              <option value="">Kein bestimmtes Studio</option>
              {Object.entries(GYMS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Card>
      <Card className="space-y-3">
        <CardTitle>Mahlzeiten & Trinkziel</CardTitle>
        <ul className="space-y-1 text-sm">
          {s.customMeals.map((m) => (
            <li key={m.id} className="flex items-center justify-between">
              {m.label}
              <Button size="sm" variant="ghost" aria-label={`${m.label} entfernen`} onClick={() => setSetting('customMeals', s.customMeals.filter((x) => x.id !== m.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input aria-label="Eigene Mahlzeit" placeholder="Eigene Mahlzeit, z. B. Pre-Workout" value={meal} onChange={(e) => setMeal(e.target.value)} />
          <Button
            onClick={() => {
              if (!meal.trim()) return;
              setSetting('customMeals', [...s.customMeals, { id: 'custom-' + uid(), label: meal.trim() }]);
              setMeal('');
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Field label="Tägliches Trinkziel (ml)">{(id) => <NumberInput id={id} value={s.waterGoalMl} onValue={(v) => v && v >= 500 && v <= 8000 && setSetting('waterGoalMl', v)} />}</Field>
      </Card>
      <Card className="space-y-3">
        <CardTitle>Datenquellen</CardTitle>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Online-Lebensmittelsuche</div>
            <div className="text-xs text-muted">Überträgt nur Suchbegriffe und Barcodes an Open Food Facts bzw. USDA – keine Körper- oder Gesundheitsdaten.</div>
          </div>
          <Switch label="Online-Suche" checked={s.externalSearchConsent} onChange={(v) => setSetting('externalSearchConsent', v)} />
        </div>
        <div className="flex items-end gap-2">
          <Field label="USDA FoodData Central API-Schlüssel (optional)" className="flex-1" hint="Kostenlos unter fdc.nal.usda.gov/api-key-signup. Wird nur lokal gespeichert.">
            {(id) => <Input id={id} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />}
          </Field>
          <Button variant="secondary" onClick={() => { setSetting('usdaApiKey', key.trim()); toast('Gespeichert', 'success'); }}>
            Speichern
          </Button>
        </div>
        <p className="text-xs text-muted">Status: Open Food Facts aktiv · USDA {usdaFoodData.isConfigured() ? <Badge tone="accent">konfiguriert</Badge> : <Badge>nicht konfiguriert</Badge>}</p>
      </Card>
      <Card className="space-y-2">
        <CardTitle>Integrationen</CardTitle>
        <p className="text-sm text-muted">Android Health Connect und Apple HealthKit sind nur für native Apps verfügbar und in dieser PWA <b>nicht</b> aktiv. Die Datenarchitektur (Provider-Schnittstellen, Import über Backup/CSV) ist dafür vorbereitet.</p>
        <p className="text-sm text-muted">Cloud-Synchronisierung und KI-Assistenz sind nicht aktiv – alle Daten bleiben auf diesem Gerät.</p>
      </Card>
      <Card className="space-y-2">
        <CardTitle>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-4 w-4" /> Lizenzen & Hinweise
          </span>
        </CardTitle>
        <p className="text-xs text-muted">{openFoodFacts.attribution} Produktbilder: CC BY-SA 3.0.</p>
        <p className="text-xs text-muted">{usdaFoodData.attribution}</p>
        <p className="text-xs text-muted">Energie-, Trainings- und Körperfettwerte sind Schätzungen und ersetzen keine medizinische Beratung.</p>
      </Card>
    </div>
  );
}

function DataSettings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const [csvKind, setCsvKind] = useState<'diary' | 'measurements' | 'workouts'>('diary');
  const [usage, setUsage] = useState<string>();
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage(`${fmt((e.usage ?? 0) / 1024 / 1024, 1)} MB belegt`)).catch(() => undefined);
  }, []);
  const exportJson = async () => {
    const b = await exportBackup();
    download(`fitcore-backup-${today()}.json`, JSON.stringify(b, null, 2));
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (!(await confirmDialog({ title: 'Backup wiederherstellen?', text: 'Alle aktuellen lokalen Daten werden durch das Backup ersetzt.', danger: true, confirmLabel: 'Wiederherstellen' }))) return;
      const r = await restoreBackup(json);
      toast(`Wiederhergestellt: ${r.counts.diary ?? 0} Tagebucheinträge, ${r.counts.workouts ?? 0} Workouts, ${r.counts.measurements ?? 0} Messungen`, 'success');
      nav('/');
    } catch (e) {
      toast('Backup ungültig: ' + firstError(e), 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const exportCsv = async () => {
    if (csvKind === 'diary') download(`fitcore-tagebuch-${today()}.csv`, diaryCSV(await db.diary.orderBy('date').toArray()), 'text/csv');
    if (csvKind === 'measurements') download(`fitcore-messungen-${today()}.csv`, measurementsCSV(await db.measurements.orderBy('date').toArray()), 'text/csv');
    if (csvKind === 'workouts') download(`fitcore-workouts-${today()}.csv`, workoutsCSV(await db.workouts.orderBy('date').toArray()), 'text/csv');
  };
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <CardTitle>Backup</CardTitle>
        <p className="text-sm text-muted">Vollständiges JSON-Backup aller lokalen Daten. Regelmäßig sichern – beim Löschen der Browserdaten gehen lokale Daten verloren. {usage}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportJson}>
            <Download className="h-4 w-4" /> Backup exportieren
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Backup wiederherstellen
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" data-testid="backup-file" onChange={(e) => importJson(e.target.files?.[0])} />
        </div>
      </Card>
      <Card className="space-y-3">
        <CardTitle>CSV-Export</CardTitle>
        <div className="flex gap-2">
          <Select aria-label="CSV-Art" value={csvKind} onChange={(e) => setCsvKind(e.target.value as typeof csvKind)}>
            <option value="diary">Ernährungstagebuch</option>
            <option value="measurements">Körpermessungen</option>
            <option value="workouts">Workouts (Sätze)</option>
          </Select>
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
      </Card>
      <Card className="space-y-3">
        <CardTitle>App-Update erzwingen</CardTitle>
        <p className="text-sm text-muted">Lädt die neueste App-Version aus dem Internet. Deine Daten bleiben erhalten.</p>
        <Button variant="outline" onClick={() => forceAppUpdate()}>
          App neu laden
        </Button>
      </Card>
      <Card className="space-y-3">
        <CardTitle>Alle Daten löschen</CardTitle>
        <Button
          variant="danger"
          onClick={async () => {
            if (await confirmDialog({ title: 'Wirklich alle Daten löschen?', text: 'Profil, Tagebuch, Trainings und Messungen werden unwiderruflich von diesem Gerät gelöscht. Exportiere vorher ein Backup.', danger: true, confirmLabel: 'Alles löschen' })) {
              await wipeAllData();
              location.reload();
            }
          }}
        >
          <Trash2 className="h-4 w-4" /> Alle lokalen Daten löschen
        </Button>
      </Card>
      <p className="flex items-center gap-1 text-xs text-muted">
        <Sparkles className="h-3 w-3" /> FitCore {APP_VERSION} · Datenbankschema v{db.verno}
      </p>
    </div>
  );
}
