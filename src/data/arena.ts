// Held, Rivalen und Markt – gespeichert in den lokalen Einstellungen.
import { getSettings, setSetting, type Rival } from './profileRepo';
import { encodeShare, SHOP, classById, denare, type Hero, type ShareCard } from '@/domain/rpg';
import type { GameState } from '@/domain/gamification';
import { today, uid } from '@/domain/dates';

export async function saveHero(h: Omit<Hero, 'id' | 'createdAt'> & Partial<Pick<Hero, 'id' | 'createdAt'>>) {
  const name = h.name.trim();
  if (!name) throw new Error('Bitte gib deinem Helden einen Namen.');
  if (name.length > 30) throw new Error('Der Name darf höchstens 30 Zeichen lang sein.');
  if (!classById(h.classId)) throw new Error('Bitte wähle eine Klasse.');
  const prev = (await getSettings()).hero;
  const hero: Hero = { ...prev, ...h, name, id: h.id ?? prev?.id ?? uid(), createdAt: h.createdAt ?? prev?.createdAt ?? today() };
  await setSetting('hero', hero);
  return hero;
}

export function buildShareCard(hero: Hero, game: GameState): ShareCard {
  return {
    v: 1,
    id: hero.id,
    n: hero.name,
    k: hero.classId,
    e: hero.emblem,
    col: hero.color,
    ...(hero.title ? { t: hero.title } : {}),
    ...(hero.frame && hero.frame !== 'bronze' ? { fr: hero.frame } : {}),
    l: game.level.level,
    x: game.xp,
    f: game.battle.score,
    w: game.battle.avgWeek,
    s: game.battle.days,
    b: game.campaign.defeated.length,
    c: game.colosseumWins.length,
    d: today(),
  };
}

export function shareLink(code: string) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/erfolge?tab=arena&rivale=${code}`;
}

export function shareText(card: ShareCard) {
  const cls = classById(card.k)?.name ?? '';
  return [
    `⚔️ ${card.n}${card.t ? ' ' + card.t : ''} · ${cls}, Stufe ${card.l}`,
    `Kampfwert (28 Tage): ${card.f.toLocaleString('de-DE')} · Ø ${card.w.toLocaleString('de-DE')} EP/Woche`,
    `Bosse besiegt: ${card.b} · Kolosseum-Siege: ${card.c}`,
    'Tritt in der FitCore-Arena gegen mich an:',
  ].join('\n');
}

/** Teilt über das Teilen-Menü des Handys; ohne Teilen-Menü wird in die Zwischenablage kopiert. */
export async function shareCard(card: ShareCard): Promise<'shared' | 'copied' | 'cancelled'> {
  const code = encodeShare(card);
  const url = shareLink(code);
  const text = shareText(card);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'FitCore-Arena', text, url });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(`${text}\n${url}`);
  return 'copied';
}

export async function addRival(card: ShareCard) {
  const s = await getSettings();
  if (s.hero && card.id === s.hero.id) throw new Error('Das ist dein eigener Held.');
  const existing = s.rivals.find((r) => r.id === card.id);
  if (existing && existing.d > card.d) throw new Error(`Du hast von ${card.n} schon einen neueren Stand.`);
  const rival: Rival = { ...card, importedAt: new Date().toISOString() };
  await setSetting('rivals', [...s.rivals.filter((r) => r.id !== card.id), rival]);
  return existing ? 'updated' : 'added';
}

export async function removeRival(id: string) {
  const s = await getSettings();
  await setSetting('rivals', s.rivals.filter((r) => r.id !== id));
}

export async function buyItem(itemId: string, xp: number) {
  const item = SHOP.find((x) => x.id === itemId);
  if (!item) throw new Error('Unbekannter Gegenstand.');
  const s = await getSettings();
  if (s.purchases.includes(itemId)) throw new Error('Schon gekauft.');
  const { balance } = denare(xp, s.purchases);
  if (balance < item.price) throw new Error(`Dir fehlen noch ${item.price - balance} Denare.`);
  await setSetting('purchases', [...s.purchases, itemId]);
}

export async function equip(kind: 'palette' | 'title' | 'frame', value: string | undefined) {
  const s = await getSettings();
  if (!s.hero) throw new Error('Erschaffe zuerst deinen Helden.');
  const patch: Partial<Hero> = kind === 'palette' ? { palette: (value ?? 'imperium') as Hero['palette'] } : kind === 'frame' ? { frame: (value ?? 'bronze') as Hero['frame'] } : { title: value };
  await setSetting('hero', { ...s.hero, ...patch });
}
