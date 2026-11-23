// Übersichtliche Übungsauswahl: Körperregionen statt 20 Muskelgruppen, eingeklappte Abschnitte,
// zuletzt trainierte Übungen oben und ein kleines Körper-Symbol je Übung.
import { useMemo, useState } from 'react';
import { ChevronDown, Search, History } from 'lucide-react';
import { Badge, Input, Select, cn } from './ui';
import { useExercises, useSettings, useWorkouts } from '@/hooks/data';
import { searchExercises } from '@/data/trainingRepo';
import { EQUIPMENT, GYMS } from '@/data/exerciseLibrary';
import type { Exercise } from '@/domain/types';

export type RegionId = 'brust' | 'ruecken' | 'schultern' | 'arme' | 'beine' | 'gesaess' | 'core' | 'mobility' | 'ausdauer';

export const REGIONS: { id: RegionId; label: string }[] = [
  { id: 'brust', label: 'Brust' },
  { id: 'ruecken', label: 'Rücken' },
  { id: 'schultern', label: 'Schultern' },
  { id: 'arme', label: 'Arme' },
  { id: 'beine', label: 'Beine' },
  { id: 'gesaess', label: 'Gesäß' },
  { id: 'core', label: 'Bauch & Core' },
  { id: 'mobility', label: 'Dehnen & Mobility' },
  { id: 'ausdauer', label: 'Ausdauer & Ganzkörper' },
];

const MUSCLE_REGION: Record<string, RegionId> = {
  Brust: 'brust',
  Latissimus: 'ruecken',
  'Oberer Rücken': 'ruecken',
  'Unterer Rücken': 'ruecken',
  Trapez: 'ruecken',
  'Vordere Schulter': 'schultern',
  'Seitliche Schulter': 'schultern',
  'Hintere Schulter': 'schultern',
  Bizeps: 'arme',
  Trizeps: 'arme',
  Unterarme: 'arme',
  Quadrizeps: 'beine',
  'Rückseite Oberschenkel': 'beine',
  Adduktoren: 'beine',
  Waden: 'beine',
  Hüftbeuger: 'beine',
  Gesäß: 'gesaess',
  Core: 'core',
  Ganzkörper: 'ausdauer',
  Ausdauer: 'ausdauer',
};

export function regionOf(e: Pick<Exercise, 'primaryMuscle' | 'kind'>): RegionId {
  if (e.kind === 'mobility') return 'mobility';
  if (e.kind === 'cardio') return 'ausdauer';
  return MUSCLE_REGION[e.primaryMuscle] ?? 'ausdauer';
}

/** Kleines Körper-Symbol, die trainierte Region ist farbig hervorgehoben. */
export function RegionIcon({ region, className }: { region: RegionId; className?: string }) {
  const on = (r: RegionId | RegionId[]) => ((Array.isArray(r) ? r : [r]).includes(region) ? 'fill-gold' : 'fill-fg/30');
  const all = region === 'ausdauer' || region === 'mobility';
  const part = (r: RegionId | RegionId[]) => (all ? (region === 'ausdauer' ? 'fill-gold/70' : 'fill-accent/60') : on(r));
  return (
    <svg viewBox="0 0 24 32" className={cn('h-8 w-6 shrink-0', className)} aria-hidden>
      <circle cx="12" cy="3.6" r="2.8" className="fill-fg/40" />
      {/* Schultern */}
      <circle cx="6.6" cy="8.6" r="2.1" className={part('schultern')} />
      <circle cx="17.4" cy="8.6" r="2.1" className={part('schultern')} />
      {/* Brust / Rücken (Oberkörper) */}
      <rect x="8.2" y="7.2" width="7.6" height="5.6" rx="1.6" className={part(['brust', 'ruecken'])} />
      {/* Bauch & Core */}
      <rect x="8.7" y="13.3" width="6.6" height="4.6" rx="1.4" className={part('core')} />
      {/* Arme */}
      <rect x="3.6" y="10.6" width="2.6" height="8.4" rx="1.3" className={part('arme')} />
      <rect x="17.8" y="10.6" width="2.6" height="8.4" rx="1.3" className={part('arme')} />
      {/* Gesäß / Hüfte */}
      <rect x="8.4" y="18.4" width="7.2" height="3.4" rx="1.5" className={part('gesaess')} />
      {/* Beine */}
      <rect x="8.4" y="22.2" width="3.1" height="9" rx="1.5" className={part('beine')} />
      <rect x="12.5" y="22.2" width="3.1" height="9" rx="1.5" className={part('beine')} />
      {region === 'ruecken' && <path d="M12 7.8v4.6" className="stroke-bg" strokeWidth="0.9" />}
    </svg>
  );
}

export function ExerciseBrowser({ onPick, gymBadges = true }: { onPick: (e: Exercise) => void; gymBadges?: boolean }) {
  const all = useExercises();
  const workouts = useWorkouts();
  const settings = useSettings();
  const [q, setQ] = useState('');
  const [region, setRegion] = useState<RegionId | ''>('');
  const [equipment, setEquipment] = useState('');
  const [gymOnly, setGymOnly] = useState<boolean | null>(null);
  const [open, setOpen] = useState<Set<RegionId>>(new Set());
  const gym = settings.homeGym;
  const onlyGym = gymOnly ?? !!gym;

  const list = useMemo(() => searchExercises(all, q, undefined, { gym: onlyGym ? gym : undefined, equipment: equipment || undefined }).filter((e) => !region || regionOf(e) === region), [all, q, onlyGym, gym, equipment, region]);
  const byRegion = useMemo(() => {
    const m = new Map<RegionId, Exercise[]>();
    for (const e of list) m.set(regionOf(e), [...(m.get(regionOf(e)) ?? []), e]);
    return m;
  }, [list]);
  const recent = useMemo(() => {
    const ids: string[] = [];
    for (const w of [...workouts].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) for (const e of w.exercises) if (!ids.includes(e.exerciseId)) ids.push(e.exerciseId);
    const map = new Map(all.map((e) => [e.id, e]));
    return ids.slice(0, 6).flatMap((id) => (map.get(id) ? [map.get(id)!] : []));
  }, [workouts, all]);

  const filtering = !!q.trim() || !!region || !!equipment;
  const isOpen = (r: RegionId) => filtering || open.has(r);
  const toggle = (r: RegionId) => setOpen((s) => (s.has(r) ? new Set([...s].filter((x) => x !== r)) : new Set([...s, r])));

  const row = (e: Exercise) => (
    <li key={e.id}>
      <button className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-fg/[0.04]" onClick={() => onPick(e)}>
        <RegionIcon region={regionOf(e)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{e.name}</span>
          <span className="block truncate text-xs text-muted">
            {e.primaryMuscle} · {e.equipment}
          </span>
        </span>
        {e.isCustom ? <Badge>eigene</Badge> : gymBadges && e.gyms?.length ? <Badge tone="accent">Studio</Badge> : null}
      </button>
    </li>
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted" />
        <Input aria-label="Übung suchen" className="pl-10" placeholder="Übung suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* Körperregionen als Kacheln */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Körperregion">
        {REGIONS.map((r) => {
          const on = region === r.id;
          return (
            <button key={r.id} type="button" aria-pressed={on} onClick={() => setRegion(on ? '' : r.id)} className={cn('flex w-[4.6rem] shrink-0 flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] leading-tight', on ? 'border-gold bg-gold/10 text-fg' : 'text-muted')}>
              <RegionIcon region={r.id} className="h-10 w-7" />
              <span className="text-center">{r.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Gerät / Equipment" className="h-9 w-auto flex-1 text-sm" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          <option value="">Alle Geräte</option>
          {EQUIPMENT.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
        {gym && (
          <button type="button" aria-pressed={onlyGym} onClick={() => setGymOnly(!onlyGym)} className={cn('h-9 rounded-full border px-3 text-xs', onlyGym ? 'border-accent bg-accent/10 text-accent' : 'text-muted')}>
            Nur {GYMS[gym] ?? 'mein Studio'}
          </button>
        )}
      </div>

      {!filtering && recent.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gold">
            <History className="h-3.5 w-3.5" /> Zuletzt trainiert
          </div>
          <ul data-testid="recent-exercises">{recent.map(row)}</ul>
        </div>
      )}

      <div className="text-xs text-muted">{list.length} Übungen</div>
      <div className="space-y-2" data-testid="exercise-list">
        {REGIONS.filter((r) => byRegion.get(r.id)?.length).map((r) => {
          const items = byRegion.get(r.id)!;
          const expanded = isOpen(r.id);
          return (
            <section key={r.id} className="rounded-2xl border" data-testid="exercise-region">
              <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left" aria-expanded={expanded} onClick={() => toggle(r.id)} disabled={filtering}>
                <RegionIcon region={r.id} />
                <span className="flex-1 text-sm font-semibold">{r.label}</span>
                <span className="text-xs text-muted">{items.length}</span>
                {!filtering && <ChevronDown className={cn('h-4 w-4 text-muted transition', expanded && 'rotate-180')} />}
              </button>
              {expanded && <ul className="border-t px-2 pb-1">{items.map(row)}</ul>}
            </section>
          );
        })}
        {!list.length && <p className="py-4 text-center text-sm text-muted">Keine Übung gefunden.</p>}
      </div>
    </div>
  );
}
