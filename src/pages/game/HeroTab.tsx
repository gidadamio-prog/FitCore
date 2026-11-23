import { useState } from 'react';
import { Pencil, Flag, Sparkles } from 'lucide-react';
import { Button, Card, CardTitle, Field, Input, Progress, Badge, fmt, cn } from '@/components/ui';
import { HeroCrest } from '@/components/HeroCrest';
import { useProfile, useSettings } from '@/hooks/data';
import { saveHero } from '@/data/arena';
import { toast } from '@/stores/ui';
import { celebrate } from '@/stores/celebrate';
import { ATTRIBUTE_LABEL, CREST_COLORS, EMBLEMS, EMBLEM_LABEL, HERO_CLASSES, MASTERY_TIERS, classById, triumphWeek, weekRecap, type AttributeId, type EmblemId, type Hero, type HeroClassId } from '@/domain/rpg';
import type { GameState } from '@/domain/gamification';
import { formatDate, today } from '@/domain/dates';

export const TIER_COLORS = ['', '#b0743a', '#aab3bd', 'rgb(var(--gold))', '#a0244a'];

export function HeroForm({ initial, onDone }: { initial?: Hero | null; onDone?: () => void }) {
  const profile = useProfile();
  const [name, setName] = useState(initial?.name ?? profile?.name ?? '');
  const [classId, setClassId] = useState<HeroClassId | null>(initial?.classId ?? null);
  const [emblem, setEmblem] = useState<EmblemId>(initial?.emblem ?? 'aquila');
  const [color, setColor] = useState<string>(initial?.color ?? CREST_COLORS[0]);
  const [error, setError] = useState<string>();
  return (
    <Card className="space-y-4" data-testid="hero-form">
      <CardTitle>{initial ? 'Held bearbeiten' : 'Erschaffe deinen Helden'}</CardTitle>
      {!initial && <p className="text-sm text-muted">Dein Held wächst mit jedem Training, jeder Punktlandung und jedem erfüllten Feldzug. Mit ihm ziehst du gegen die Bosse des Reiches und misst dich in der Arena mit Freunden.</p>}
      <div className="flex items-center gap-4">
        <HeroCrest emblem={emblem} color={color} size={84} label="Vorschau Wappen" />
        <Field label="Name des Helden" className="flex-1" error={error}>
          {(id) => <Input id={id} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />}
        </Field>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">Klasse</div>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Klasse">
          {HERO_CLASSES.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={classId === c.id}
              onClick={() => setClassId(c.id)}
              className={cn('rounded-2xl border p-3 text-left transition', classId === c.id ? 'border-gold bg-gold/10' : 'hover:bg-fg/[0.04]')}
            >
              <div className="font-brand font-semibold">{c.name}</div>
              <div className="text-xs italic text-muted">„{c.motto}“</div>
              <div className="mt-1 text-xs">{c.description}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">Emblem</div>
        <div className="flex flex-wrap gap-2">
          {EMBLEMS.map((e) => (
            <Button key={e} size="sm" variant={emblem === e ? 'primary' : 'secondary'} aria-pressed={emblem === e} onClick={() => setEmblem(e)}>
              {EMBLEM_LABEL[e]}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">Wappenfarbe</div>
        <div className="flex flex-wrap gap-2">
          {CREST_COLORS.map((c) => (
            <button key={c} aria-label={`Farbe ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={cn('h-10 w-10 rounded-full border-2', color === c ? 'border-gold' : 'border-transparent')} style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={async () => {
            try {
              if (!classId) throw new Error('Bitte wähle eine Klasse.');
              await saveHero({ name, classId, emblem, color });
              setError(undefined);
              toast(initial ? 'Held gespeichert' : 'Dein Held ist erschaffen – Ave!', 'success');
              onDone?.();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {initial ? 'Speichern' : 'Held erschaffen'}
        </Button>
        {initial && onDone && (
          <Button variant="ghost" onClick={onDone}>
            Abbrechen
          </Button>
        )}
      </div>
    </Card>
  );
}

export function HeroSummary({ hero, game, compact = false }: { hero: Hero; game: GameState; compact?: boolean }) {
  const cls = classById(hero.classId);
  const lv = game.level;
  return (
    <div className="flex items-center gap-4" data-testid="hero-summary">
      <HeroCrest emblem={hero.emblem} color={hero.color} frame={hero.frame} size={compact ? 64 : 92} label={`Wappen von ${hero.name}`} />
      <div className="min-w-0 flex-1">
        <div className={cn('font-brand truncate font-bold', compact ? 'text-lg' : 'text-2xl')} data-testid="hero-name">
          {hero.name}
          {hero.title && <span className="ml-1 text-sm font-normal text-gold">{hero.title}</span>}
        </div>
        <div className="text-xs text-muted">
          {cls?.name} · <span data-testid="hero-level">Stufe {lv.level}</span> · Kampfwert <span data-testid="battle-score">{fmt(game.battle.score)}</span>
        </div>
        <Progress className="mt-2" value={lv.progress * 100} max={100} label="Fortschritt zur nächsten Stufe" />
        <div className="mt-1 text-[11px] text-muted">{lv.next ? `Noch ${fmt(lv.toNext)} EP bis Stufe ${lv.level + 1}` : 'Höchste Stufe erreicht'}</div>
      </div>
    </div>
  );
}

export function HeroTab({ game }: { game: GameState }) {
  const { hero } = useSettings();
  const [editing, setEditing] = useState(false);
  if (!hero) return <HeroForm />;
  if (editing) return <HeroForm initial={hero} onDone={() => setEditing(false)} />;
  const attrs = game.attributes;
  const power = (Object.keys(attrs) as AttributeId[]).reduce((a, k) => a + attrs[k].level, 0);
  const lw = game.lifework;
  const showTriumph = () => {
    const ws = triumphWeek(today(), new Date().getHours());
    const r = weekRecap(ws, game.facts, game.xpByDay, game.damageByDay, today());
    celebrate(triumphCelebration(r, hero.name));
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="space-y-4">
        <HeroSummary hero={hero} game={game} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Bearbeiten
          </Button>
          <Button size="sm" variant="secondary" onClick={showTriumph}>
            <Flag className="h-4 w-4" /> Triumphzug der Woche
          </Button>
        </div>
      </Card>
      <Card>
        <CardTitle action={<Badge tone="accent">Macht {power}</Badge>}>Attribute</CardTitle>
        <ul className="space-y-3" data-testid="attributes">
          {(Object.keys(attrs) as AttributeId[]).map((k) => (
            <li key={k}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {ATTRIBUTE_LABEL[k].name}
                  {classById(hero.classId)?.primary === k && <span className="ml-1 text-[11px] text-gold">Hauptattribut</span>}
                </span>
                <span className="tabular-nums" data-testid={`attr-${k}`}>
                  {attrs[k].level}
                </span>
              </div>
              <Progress className="mt-1" value={attrs[k].level} max={99} label={ATTRIBUTE_LABEL[k].name} />
              <div className="mt-0.5 text-[11px] text-muted">{ATTRIBUTE_LABEL[k].source}</div>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Meisterschaft der Waffen</CardTitle>
        {game.mastery.length ? (
          <ul className="divide-y text-sm" data-testid="mastery">
            {game.mastery.slice(0, 12).map((m) => {
              const next = m.thresholds[m.tier];
              return (
                <li key={m.exerciseId} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{m.name}</span>
                    <span className="text-[11px] text-muted">
                      {m.kind === 'standard' ? `${fmt(m.value, 2)} × Körpergewicht (e1RM)` : m.sessions < 2 ? 'Ab der 2. Einheit wird die Steigerung gemessen' : `+${fmt(m.value * 100)} % seit der ersten Einheit`}
                      {next != null && (m.kind === 'standard' ? ` · nächste Stufe ab ${fmt(next, 2)} ×` : m.sessions >= 2 ? ` · nächste Stufe ab +${fmt(next * 100)} %` : '')}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: m.tier ? TIER_COLORS[m.tier] : undefined, border: '1px solid currentColor' }}>
                    {m.tier ? MASTERY_TIERS[m.tier - 1] : 'offen'}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sobald du Übungen mit Gewicht trainierst, steigen sie hier von Bronze bis Purpur auf.</p>
        )}
        <p className="mt-2 text-[11px] text-muted">Bankdrücken, Kniebeuge, Kreuzheben, Schulterdrücken und Langhantelrudern werden an groben Richtwerten (e1RM ÷ Körpergewicht) gemessen, alle anderen Übungen an deiner Steigerung seit der ersten Einheit. Je Stufe +25 EP.</p>
      </Card>
      <Card>
        <CardTitle>
          <span className="flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-gold" /> Lebenswerk
          </span>
        </CardTitle>
        <div className="grid grid-cols-2 gap-3 text-sm" data-testid="lifework">
          <div>
            <div className="text-xs text-muted">Gesamtvolumen</div>
            <div className="text-xl font-bold tabular-nums">{fmt(lw.volume)} kg</div>
            {lw.volume > 0 && (
              <div className="text-[11px] text-muted" data-testid="lifework-comparison">
                ≈ {fmt(lw.comparison.count, lw.comparison.count < 10 ? 1 : 0)} {lw.comparison.label}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted">Ausdauer</div>
            <div className="text-xl font-bold tabular-nums">{fmt(lw.km, 1)} km</div>
            {lw.km > 0 && <div className="text-[11px] text-muted">{fmt(lw.viaAppia * 100, 1)} % der Via Appia (Rom–Brundisium, ca. 540 km)</div>}
          </div>
          <div>
            <div className="text-xs text-muted">Einheiten</div>
            <div className="text-xl font-bold tabular-nums">{fmt(lw.sessions)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Trainingszeit</div>
            <div className="text-xl font-bold tabular-nums">{fmt(lw.hours, 1)} h</div>
          </div>
          <div>
            <div className="text-xs text-muted">Sätze</div>
            <div className="text-xl font-bold tabular-nums">{fmt(lw.sets)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Punktlandungen</div>
            <div className="text-xl font-bold tabular-nums">{fmt(game.mealHitsTotal)}</div>
          </div>
        </div>
        {game.comebacks.length > 0 && <p className="mt-3 text-[11px] text-muted">Phönix: {game.comebacks.length}× nach einer Pause zurückgekehrt, zuletzt am {formatDate(game.comebacks[game.comebacks.length - 1]!)}.</p>}
      </Card>
    </div>
  );
}

export function triumphCelebration(r: ReturnType<typeof weekRecap>, name: string) {
  const duel = r.duel.won == null ? 'kein Schatten-Duell (vor 4 Wochen noch keine Daten)' : `${r.duel.won ? 'gewonnen' : r.duel.complete ? 'verloren' : 'läuft'} (${r.duel.wins}:${r.duel.losses})`;
  return {
    kind: 'triumph' as const,
    title: `Triumphzug für ${name}`,
    subtitle: `Woche ab ${formatDate(r.weekStart, { day: '2-digit', month: '2-digit' })}`,
    lines: [
      `${fmt(r.xp)} EP · ${fmt(r.damage)} Schaden`,
      `${r.sessions} Einheiten · ${fmt(r.volume)} kg · ${fmt(r.cardioMin)} min Ausdauer`,
      `${r.loggedDays} Tage protokolliert · ${r.mealHits} Punktlandungen${r.prs ? ` · ${r.prs} Bestleistungen` : ''}`,
      `Schatten-Duell: ${duel}`,
    ],
  };
}
