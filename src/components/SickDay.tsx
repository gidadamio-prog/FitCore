import { useState } from 'react';
import { Thermometer } from 'lucide-react';
import { Button, Card, Sheet } from '@/components/ui';
import { toggleSickDay } from '@/data/profileRepo';
import { useSettings } from '@/hooks/data';
import { addDays, today } from '@/domain/dates';
import { SICK_WEEK_MIN } from '@/domain/gamification';
import { toast } from '@/stores/ui';

const RULES = [
  'Deine Ernährungs-Serie läuft weiter: der Krankentag zählt nicht mit, bricht aber nichts.',
  `Trainings-Serie: Eine Woche mit mindestens ${SICK_WEEK_MIN} Krankentagen darf ohne Training bleiben.`,
  'Tagesauftrag wird zum Heiltrank: trink genug, das bringt EP.',
  'Schritt- und Trainingsziel sind heute keine Pflicht.',
];

/** Hinweis oben auf „Heute“, solange der Tag als krank gemeldet ist. */
export function SickBanner() {
  const { sickDays } = useSettings();
  const d = today();
  if (!sickDays?.includes(d)) return null;
  return (
    <Card className="flex items-center gap-3 border-sky-400/40 bg-sky-400/5" data-testid="sick-banner">
      <Thermometer className="h-6 w-6 shrink-0 text-sky-400" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Krankentag – gute Besserung!</div>
        <div className="text-xs text-muted">Serien sind pausiert. Ruh dich aus und trink genug.</div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        data-testid="sick-undo"
        onClick={async () => {
          await toggleSickDay(d, d);
          toast('Krankmeldung zurückgenommen', 'success');
        }}
      >
        Doch fit
      </Button>
    </Card>
  );
}

/** Knopf „Krank“ mit Erklärung; heute und gestern können gemeldet werden. */
export function SickButton() {
  const { sickDays } = useSettings();
  const [open, setOpen] = useState(false);
  const d = today();
  const y = addDays(d, -1);
  const isSick = (x: string) => !!sickDays?.includes(x);
  const toggle = async (x: string) => {
    const sick = await toggleSickDay(x, d);
    toast(sick ? (x === d ? 'Gute Besserung! Heute ist ein Krankentag.' : 'Gestern als Krankentag gemeldet') : 'Krankmeldung zurückgenommen', 'success');
  };
  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-3 py-1 text-sm text-sky-300"
        onClick={() => setOpen(true)}
        data-testid="sick-open"
      >
        <Thermometer className="h-4 w-4" /> {isSick(d) ? 'Krank gemeldet' : 'Krank?'}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Krankentag">
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <div className="space-y-2">
          <Button className="w-full" variant={isSick(d) ? 'secondary' : 'primary'} data-testid="sick-today" onClick={() => void toggle(d)}>
            {isSick(d) ? 'Heute doch nicht krank' : 'Heute krank melden'}
          </Button>
          <Button className="w-full" variant="secondary" data-testid="sick-yesterday" onClick={() => void toggle(y)}>
            {isSick(y) ? 'Gestern doch nicht krank' : 'Gestern war ich auch krank'}
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-muted">Melden geht nur für heute und gestern – nachträglich lässt sich keine Serie retten.</p>
      </Sheet>
    </>
  );
}
