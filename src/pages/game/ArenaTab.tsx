import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Share2, Trash2, ClipboardPaste, Users } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Input, Tabs, fmt, cn } from '@/components/ui';
import { HeroCrest } from '@/components/HeroCrest';
import { useSettings } from '@/hooks/data';
import { addRival, buildShareCard, removeRival, shareCard } from '@/data/arena';
import { classById, decodeShare, SCORE_WINDOW_DAYS, type ShareCard } from '@/domain/rpg';
import type { GameState } from '@/domain/gamification';
import { confirmDialog, toast } from '@/stores/ui';
import { formatDate, today } from '@/domain/dates';

type SortKey = 'f' | 'w' | 'l';
const SORT_LABEL: Record<SortKey, string> = { f: 'Kampfwert', w: 'Ø/Woche', l: 'Stufe' };

function daysAgo(d: string) {
  return Math.round((new Date(today() + 'T12:00:00Z').getTime() - new Date(d + 'T12:00:00Z').getTime()) / 86400000);
}

export function ArenaTab({ game }: { game: GameState }) {
  const { hero, rivals } = useSettings();
  const [params, setParams] = useSearchParams();
  const [pending, setPending] = useState<ShareCard | null>(null);
  const [paste, setPaste] = useState('');
  const [sort, setSort] = useState<SortKey>('f');

  // Link eines Freundes geöffnet: …#/erfolge?tab=arena&rivale=FC1.…
  useEffect(() => {
    const code = params.get('rivale');
    if (!code) return;
    try {
      setPending(decodeShare(code));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
    const next = new URLSearchParams(params);
    next.delete('rivale');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const me = hero ? buildShareCard(hero, game) : null;
  const rows = useMemo(() => {
    const list: (ShareCard & { self?: boolean })[] = [...rivals];
    if (me) list.push({ ...me, self: true });
    return list.sort((a, b) => b[sort] - a[sort] || b.x - a.x);
  }, [rivals, me, sort]);

  const accept = async (card: ShareCard) => {
    try {
      const r = await addRival(card);
      toast(r === 'added' ? `${card.n} ist jetzt dein Rivale` : `Stand von ${card.n} aktualisiert`, 'success');
      setPending(null);
      setPaste('');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {pending && (
        <Card className="border-gold/50 lg:col-span-2" data-testid="rival-preview">
          <CardTitle>Rivale hinzufügen?</CardTitle>
          <div className="flex items-center gap-3">
            <HeroCrest emblem={pending.e} color={pending.col} frame={pending.fr} size={64} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-brand text-lg font-bold">
                {pending.n} {pending.t && <span className="text-sm font-normal text-gold">{pending.t}</span>}
              </div>
              <div className="text-xs text-muted">
                {classById(pending.k)?.name} · Stufe {pending.l} · Kampfwert {fmt(pending.f)} · Stand {formatDate(pending.d)}
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={() => accept(pending)}>
              Hinzufügen
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Verwerfen
            </Button>
          </div>
        </Card>
      )}

      <Card className="space-y-3 lg:col-span-2">
        <CardTitle>
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4 text-gold" /> Rangliste
          </span>
        </CardTitle>
        <Tabs value={sort} onChange={setSort} items={(Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({ value: k, label: SORT_LABEL[k] }))} />
        {rows.length ? (
          <ol className="divide-y" data-testid="ranking">
            {rows.map((r, idx) => {
              const age = daysAgo(r.d);
              return (
                <li key={r.id} className={cn('flex items-center gap-3 py-2', r.self && 'rounded-xl bg-gold/10 px-2')} data-testid={r.self ? 'ranking-me' : 'ranking-rival'}>
                  <span className={cn('w-6 text-center font-brand text-lg font-bold', idx === 0 ? 'text-gold' : 'text-muted')}>{idx + 1}</span>
                  <HeroCrest emblem={r.e} color={r.col} frame={r.fr} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {r.n}
                      {r.t && <span className="ml-1 text-xs font-normal text-gold">{r.t}</span>}
                      {r.self && <span className="ml-1 text-xs font-normal text-muted">(du)</span>}
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {classById(r.k)?.name} · Stufe {r.l}
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {r.b} Bosse · {r.c}× Kolosseum
                      {!r.self && ` · ${age === 0 ? 'heute' : age === 1 ? 'gestern' : `vor ${age} T.`}`}
                    </div>
                    {!r.self && age > 7 && <div className="text-[11px] text-warn">Veraltet – bitte neu teilen lassen</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold tabular-nums" data-testid="ranking-value">
                      {fmt(r[sort])}
                    </div>
                    <div className="text-[10px] text-muted">{sort === 'f' ? `EP / ${SCORE_WINDOW_DAYS} T` : sort === 'w' ? 'EP / Woche' : 'Stufe'}</div>
                  </div>
                  {!r.self && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`${r.n} entfernen`}
                      onClick={async () => {
                        if (await confirmDialog({ title: `${r.n} entfernen?`, text: 'Der Rivale verschwindet aus deiner Rangliste. Du kannst ihn jederzeit über einen neuen Code wieder hinzufügen.', confirmLabel: 'Entfernen', danger: true })) await removeRival(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-muted">Erschaffe deinen Helden und teile deinen Kampfwert, um eine Rangliste aufzubauen.</p>
        )}
        <p className="text-[11px] text-muted">
          <b>Kampfwert</b> = deine EP der letzten {SCORE_WINDOW_DAYS} Tage. Damit ist es egal, wer wann angefangen hat: Alle sammeln im gleichen Zeitfenster. <b>Ø pro Woche</b> vergleicht den Schnitt seit dem jeweiligen Start. Geteilt werden nur Spielwerte, keine Körper- oder Ernährungsdaten. Da alles lokal läuft, kann FitCore die Werte nicht prüfen – Fair Play unter Legionären.
        </p>
      </Card>

      <Card className="space-y-3">
        <CardTitle>Deinen Kampfwert teilen</CardTitle>
        {me ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span>Kampfwert</span>
              <span className="font-bold tabular-nums">{fmt(me.f)}</span>
            </div>
            {game.battle.windowDays < SCORE_WINDOW_DAYS && <Badge tone="info">Im Aufbau: {game.battle.windowDays}/{SCORE_WINDOW_DAYS} Tage im Fenster</Badge>}
            <Button
              className="w-full"
              onClick={async () => {
                try {
                  const r = await shareCard(me);
                  if (r === 'copied') toast('Text und Link kopiert – füge sie in WhatsApp & Co. ein', 'success');
                } catch {
                  toast('Teilen nicht möglich', 'error');
                }
              }}
            >
              <Share2 className="h-4 w-4" /> Teilen
            </Button>
            <p className="text-[11px] text-muted">Dein Freund öffnet den Link in seiner FitCore-App (oder fügt ihn unten ein) und du erscheinst in seiner Rangliste. Teile nach dem Training erneut, damit dein Stand aktuell bleibt.</p>
          </>
        ) : (
          <p className="text-sm text-muted">Erst einen Helden erschaffen (Reiter „Held“).</p>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle>
          <span className="flex items-center gap-1">
            <ClipboardPaste className="h-4 w-4" /> Code eines Freundes einfügen
          </span>
        </CardTitle>
        <Input aria-label="Arena-Code oder Link" placeholder="Nachricht, Link oder FC1-Code einfügen" value={paste} onChange={(e) => setPaste(e.target.value)} />
        <Button
          variant="secondary"
          className="w-full"
          disabled={!paste.trim()}
          onClick={() => {
            try {
              setPending(decodeShare(paste));
            } catch (e) {
              toast((e as Error).message, 'error');
            }
          }}
        >
          Prüfen
        </Button>
      </Card>
    </div>
  );
}
