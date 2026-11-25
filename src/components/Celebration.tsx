// Feier-Overlay (Bestleistung, Rangaufstieg, Abzeichen, Feldzug) und Beobachter für neue Erfolge.
import { ARMOR_CLASS_LABEL, ARMOR_CLASS_RARITY, ARMOR_SETS, START_SET, armorItemId, setSource } from '@/domain/armor';
import { useEffect, useRef } from 'react';
import { Trophy } from 'lucide-react';
import { Button } from './ui';
import { Laurel } from './Laurel';
import { useCelebrate, celebrate } from '@/stores/celebrate';
import { useBattle } from '@/stores/battle';
import { useGame } from '@/hooks/game';
import { db } from '@/data/db';
import { earnedBadgeKeys, TIER_LABEL, XP_RULES, type Tier } from '@/domain/gamification';
import { MASTERY_TIERS, triumphWeek, weekRecap } from '@/domain/rpg';
import { startOfWeek, today } from '@/domain/dates';
import { useSettings } from '@/hooks/data';
import { triumphCelebration } from '@/pages/game/HeroTab';
import { HeroPortrait, ItemIcon } from './rpg/Visuals';
import { APPEARANCE_STAGES, RARITY_COLOR, RARITY_LABEL, appearanceStage, badgeWeaponIds, itemById } from '@/domain/equipment';
import { weaponById, weaponRarity } from '@/domain/weapons';

export function CelebrationHost() {
  const { queue, shift } = useCelebrate();
  const battle = useBattle((s) => !!s.scene || !!s.pending); // Feiern erst nach dem Kampf
  const c = battle ? undefined : queue[0];
  useEffect(() => {
    if (c) navigator.vibrate?.([30, 40, 30]);
  }, [c]);
  if (!c) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={c.title} onClick={shift}>
      <div className="celebrate-pop relative w-full max-w-sm rounded-3xl border border-gold/40 bg-card p-6 text-center shadow-2xl shadow-primary/30" onClick={(e) => e.stopPropagation()}>
        <div className="celebrate-rays pointer-events-none absolute inset-0 rounded-3xl" />
        <div className="relative mx-auto mb-3 flex justify-center">
          {c.item && itemById(c.item.id) ? (
            <div className="chest-open relative flex h-32 w-32 items-center justify-center">
              <span className="rarity-rays" style={{ ['--rc' as string]: RARITY_COLOR[c.item.rarity], inset: '-10%' }} />
              <ItemIcon item={itemById(c.item.id)!} rarity={c.item.rarity} size={104} />
            </div>
          ) : c.portrait ? (
            <HeroPortrait classId={c.portrait.classId} rankLevel={c.portrait.rankLevel} crest={c.portrait.crest} size={120} transform aura="rgb(var(--gold))" />
          ) : (
            <Laurel size={120} className="celebrate-spin-in">
              <Trophy className="h-10 w-10 text-gold" />
            </Laurel>
          )}
        </div>
        <div className="font-brand relative text-xs uppercase tracking-[0.2em] text-gold">{{ pr: 'Neue Bestleistung', rank: 'Rangaufstieg', badge: 'Abzeichen', quest: 'Feldzug erfüllt', season: 'Saison-Triumph', boss: 'Provinz erobert', colosseum: 'Champion des Kolosseums', mastery: 'Meisterschaft', comeback: 'Comeback', duel: 'Schatten besiegt', level: 'Stufenaufstieg', triumph: 'Triumphzug', item: 'Neue Ausrüstung', transform: 'Verwandlung' }[c.kind]}</div>
        <h2 className="font-brand relative mt-1 text-2xl font-bold" data-testid="celebration-title">
          {c.title}
        </h2>
        {c.subtitle && <p className="relative mt-1 text-sm text-muted">{c.subtitle}</p>}
        {c.lines && c.lines.length > 0 && (
          <ul className="relative mt-3 space-y-1 text-sm">
            {c.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <Button className="relative mt-5 w-full" onClick={shift}>
          {useCelebrate.getState().queue.length > 1 ? 'Weiter' : 'Ave!'}
        </Button>
      </div>
    </div>
  );
}

interface Ack {
  rankLevel: number;
  badges: string[];
  quests: string[];
  seasons: string[];
  // RPG (fehlen bei älteren Ständen → werden still initialisiert)
  level?: number;
  bosses?: string[];
  colosseum?: string[];
  mastery?: string[];
  comebacks?: string[];
  duels?: string[];
  triumph?: string | null;
  /** früher: Abzeichen-Waffen alter Art (nicht mehr genutzt) */
  items?: string[];
  /** Abzeichen-Waffen (neue Waffenreihen) */
  weapons?: string[];
  stage?: number;
  armorSets?: number[];
}

/** Erkennt neue Ränge, Abzeichen, Feldzüge und Saisonsiege und feiert sie einmalig. Beim ersten Start wird still initialisiert. */
export function GameWatcher() {
  const game = useGame();
  const { hero, purchases, armorLoot } = useSettings();
  const busy = useRef(false);
  useEffect(() => {
    if (!game || busy.current) return;
    busy.current = true;
    (async () => {
      const week = startOfWeek(today());
      const t = today();
      const now: Required<Ack> = {
        rankLevel: game.rank.rank.level,
        badges: earnedBadgeKeys(game.badges),
        quests: game.quests.filter((q) => q.done).map((q) => `${week}:${q.id}`),
        seasons: game.season.challenges.filter((c) => c.done).map((c) => `${game.season.month}:${c.id}`),
        level: game.level.level,
        bosses: game.campaign.defeated.map((d) => d.boss.id),
        colosseum: game.colosseumWins.map((w) => w.month),
        mastery: game.mastery.flatMap((m) => m.reached.map((r) => `${m.exerciseId}:${r.tier}`)),
        comebacks: game.comebacks,
        duels: game.duelWeeksWon,
        triumph: null,
        items: [],
        weapons: badgeWeaponIds(game.badges),
        stage: appearanceStage(game.rank.rank.level),
        armorSets: ARMOR_SETS.filter((st) => st.idx !== START_SET && setSource(st, { rankLevel: game.rank.rank.level, defeatedBossIds: game.campaign.defeated.map((d) => d.boss.id), loot: [], purchases: [] })).map((st) => st.idx),
      };
      const row = await db.settings.get('gameAck');
      const ack = row?.value as Ack | undefined;
      if (!ack) {
        await db.settings.put({ key: 'gameAck', value: now });
        return;
      }
      // Neue Felder älterer Stände still übernehmen – keine Flut an Feiern für Vergangenes
      const prevLevel = ack.level ?? now.level;
      const prevBosses = ack.bosses ?? now.bosses;
      const prevCol = ack.colosseum ?? now.colosseum;
      const prevMastery = ack.mastery ?? now.mastery;
      const prevComebacks = ack.comebacks ?? now.comebacks;
      const prevDuels = ack.duels ?? now.duels;
      const prevWeapons = ack.weapons ?? now.weapons;
      const prevStage = ack.stage ?? now.stage;
      const prevSets = ack.armorSets ?? now.armorSets;

      if (now.rankLevel > ack.rankLevel) celebrate({ kind: 'rank', title: `${game.rank.rank.name}`, subtitle: `Du bist jetzt ${game.rank.rank.title} (Rang ${game.rank.rank.level} von 10).`, lines: [`${game.xp.toLocaleString('de-DE')} Erfahrungspunkte`] });
      for (const k of now.badges.filter((b) => !ack.badges.includes(b))) {
        const [id, tier] = k.split(':') as [string, Tier];
        const b = game.badges.find((x) => x.id === id);
        if (b) celebrate({ kind: 'badge', title: `${b.name} · ${TIER_LABEL[tier]}`, subtitle: b.description(b.tiers[['bronze', 'silver', 'gold'].indexOf(tier)]!) });
      }
      for (const k of now.quests.filter((q) => !ack.quests.includes(q))) {
        const q = game.quests.find((x) => k.endsWith(':' + x.id));
        if (q) celebrate({ kind: 'quest', title: q.title, subtitle: '+100 Erfahrungspunkte' });
      }
      for (const k of now.seasons.filter((q) => !ack.seasons.includes(q))) {
        const c = game.season.challenges.find((x) => k.endsWith(':' + x.id));
        if (c) celebrate({ kind: 'season', title: c.title, subtitle: `Saison ${game.season.name} · +250 Erfahrungspunkte` });
      }
      if (hero && now.level > prevLevel) celebrate({ kind: 'level', title: `Stufe ${now.level}`, subtitle: `${hero.name} wird stärker.` });
      for (const id of now.bosses.filter((b) => !prevBosses.includes(b))) {
        const d = game.campaign.defeated.find((x) => x.boss.id === id);
        if (d) celebrate({ kind: 'boss', title: `${d.boss.name} besiegt`, subtitle: `${d.boss.province} ist erobert · +${XP_RULES.boss.xp} EP`, lines: [`Nächster Gegner: ${game.campaign.current.boss.name} (${game.campaign.current.boss.province})`] });
      }
      for (const m of now.colosseum.filter((x) => !prevCol.includes(x))) {
        const w = game.colosseumWins.find((x) => x.month === m);
        if (w) celebrate({ kind: 'colosseum', title: `${w.name} liegt im Sand`, subtitle: `Du bist Champion des Monats · +${XP_RULES.colosseum.xp} EP` });
      }
      for (const k of now.mastery.filter((x) => !prevMastery.includes(x))) {
        const [exId, tier] = k.split(':') as [string, string];
        const m = game.mastery.find((x) => x.exerciseId === exId);
        if (m) celebrate({ kind: 'mastery', title: `${m.name} · ${MASTERY_TIERS[Number(tier) - 1]}`, subtitle: `Neue Meisterschaftsstufe · +${XP_RULES.mastery.xp} EP` });
      }
      for (const d of now.comebacks.filter((x) => !prevComebacks.includes(x))) celebrate({ kind: 'comeback', title: 'Der Phönix kehrt zurück', subtitle: `Willkommen zurück im Training (${d}) · +${XP_RULES.comeback.xp} EP` });
      for (const w of now.duels.filter((x) => !prevDuels.includes(x))) celebrate({ kind: 'duel', title: 'Schatten besiegt', subtitle: `Die Woche ab ${w} war besser als vor 4 Wochen · +${XP_RULES.duel.xp} EP` });
      for (const id of now.weapons.filter((x) => !prevWeapons.includes(x))) {
        const def = itemById(id);
        const w = weaponById(id);
        if (!def || !w) continue;
        const rarity = weaponRarity(w);
        celebrate({ kind: 'item', title: def.name, subtitle: `${RARITY_LABEL[rarity]} · Abzeichen-Belohnung`, lines: ['Im Inventar – jetzt anlegen unter Held'], item: { id, rarity } });
      }
      for (const idx of now.armorSets.filter((x) => !prevSets.includes(x))) {
        const st = ARMOR_SETS[idx]!;
        celebrate({ kind: 'item', title: `Rüstung: ${st.name}`, subtitle: `${ARMOR_CLASS_LABEL[st.cls]} · komplettes Set (5 Teile)`, lines: ['Im Inventar – jetzt anlegen unter Held'], item: { id: armorItemId(idx, 'chest'), rarity: ARMOR_CLASS_RARITY[st.cls] } });
      }
      if (hero && now.stage > prevStage) {
        const st = APPEARANCE_STAGES[now.stage - 1]!;
        celebrate({ kind: 'transform', title: `${hero.name} wird ${st.name}`, subtitle: `Erscheinungsbild ${now.stage} von 5`, portrait: { classId: hero.classId, rankLevel: game.rank.rank.level, crest: hero.color } });
      }
      // Triumphzug: einmal pro Woche, nur mit Held und wenn es etwas zu feiern gibt
      const tw = triumphWeek(t, new Date().getHours());
      let triumph = ack.triumph ?? null;
      if (hero && triumph !== tw) {
        const r = weekRecap(tw, game.facts, game.xpByDay, game.damageByDay, t);
        if (r.xp > 0) celebrate(triumphCelebration(r, hero.name));
        triumph = tw;
      }
      // Bestätigte Stände zusammenführen (nie verlieren – sonst würden gelöschte und wieder erreichte Erfolge mehrfach gefeiert)
      const merge = (a: string[], b: string[], max: number) => [...new Set([...a, ...b])].slice(-max);
      await db.settings.put({
        key: 'gameAck',
        value: {
          rankLevel: Math.max(ack.rankLevel, now.rankLevel),
          badges: merge(ack.badges, now.badges, 1000),
          quests: merge(ack.quests, now.quests, 200),
          seasons: merge(ack.seasons, now.seasons, 100),
          level: Math.max(prevLevel, now.level),
          bosses: merge(prevBosses, now.bosses, 500),
          colosseum: merge(prevCol, now.colosseum, 200),
          mastery: merge(prevMastery, now.mastery, 1000),
          comebacks: merge(prevComebacks, now.comebacks, 200),
          duels: merge(prevDuels, now.duels, 200),
          triumph,
          items: ack.items,
          weapons: merge(prevWeapons, now.weapons, 500),
          stage: Math.max(prevStage, now.stage),
        } satisfies Ack,
      });
    })().finally(() => {
      busy.current = false;
    });
  }, [game, hero, purchases, armorLoot]);
  return null;
}
