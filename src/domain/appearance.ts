// Aussehen des Ganzkörper-Helden: Merkmal-Ebenen über dem Grundkörper und Ausrüstungs-Ebenen darüber.
// Alle Ebenen teilen dasselbe Raster (1024 × 1536, Kopfoberkante y ≈ 90, Kopfmitte x ≈ 511),
// die Köpfe der 12 Grundkörper liegen pixelgenau übereinander – eine Kopf-Ebene passt auf jeden Körper.
import { ITEMS, itemFile, type ItemDef } from './equipment';

export type TraitCategory = 'hair' | 'beard' | 'scar' | 'paint' | 'eyes';

export const TRAIT_CATEGORIES: { id: TraitCategory; label: string; file: string; recolor: boolean; hint: string }[] = [
  { id: 'hair', label: 'Frisur', file: 'frisur', recolor: true, hint: 'nur die Haare, in neutralem hellem Grau mit Schattierung (Farbe kommt aus dem Code)' },
  { id: 'beard', label: 'Bart', file: 'bart', recolor: true, hint: 'nur der Bart, in neutralem hellem Grau mit Schattierung (Farbe kommt aus dem Code)' },
  { id: 'scar', label: 'Narbe', file: 'narbe', recolor: false, hint: 'nur die Narbe auf transparentem Grund, Hautton leicht heller/rötlicher als die Haut' },
  { id: 'paint', label: 'Kriegsbemalung', file: 'bemalung', recolor: false, hint: 'nur die Farbe auf dem Gesicht, mattes Pigment, Ränder leicht ausgefranst' },
  { id: 'eyes', label: 'Augen', file: 'augen', recolor: false, hint: 'nur das Accessoire mit Band/Bügel, so wie es auf dem Kopf sitzt' },
];

export interface TraitDef {
  id: string;
  category: TraitCategory;
  name: string;
  motif: string;
}

const t = (category: TraitCategory, id: string, name: string, motif: string): TraitDef => ({ id, category, name, motif });

export const TRAITS: TraitDef[] = [
  t('hair', 'kurz', 'Legionärsschnitt', 'kurzes, dichtes Haar, an den Seiten kürzer, kleine Stirnfransen'),
  t('hair', 'locken', 'Locken', 'mittellange dichte Locken, bis knapp über die Ohren'),
  t('hair', 'zopf', 'Kriegerzopf', 'Haar straff nach hinten, Seiten kurz, Zopf im Nacken (von vorne knapp sichtbar)'),
  t('hair', 'maehne', 'Mähne', 'lange offene Mähne bis auf die Schultern, leicht wild'),
  t('hair', 'irokese', 'Kammfrisur', 'Seiten rasiert, breiter Haarkamm in der Mitte nach hinten'),
  t('hair', 'knoten', 'Suebenknoten', 'Haar seitlich zu einem Knoten über dem rechten Ohr gebunden'),
  t('beard', 'stoppeln', 'Dreitagebart', 'kurze Stoppeln an Kinn, Wangen und Oberlippe'),
  t('beard', 'kinnbart', 'Kinnbart', 'schmaler Kinnbart mit Schnurrbart, Wangen frei'),
  t('beard', 'vollbart', 'Vollbart', 'gepflegter kurzer Vollbart, klare Kontur'),
  t('beard', 'barbar', 'Barbarenbart', 'langer, dichter Vollbart bis auf die Brust'),
  t('beard', 'schnauzer', 'Schnauzer', 'kräftiger, nach unten hängender Schnurrbart'),
  t('scar', 'auge', 'Narbe über dem Auge', 'senkrechte Narbe über das linke Auge (Braue bis Wange), Auge intakt'),
  t('scar', 'wange', 'Wangenschnitt', 'schräger Schnitt über die rechte Wange'),
  t('scar', 'nase', 'Nasenrücken', 'kurze quer verlaufende Narbe über den Nasenrücken'),
  t('paint', 'waid', 'Waid-Streifen', 'drei blaue Streifen quer über beide Wangen (britannisch)'),
  t('paint', 'blut', 'Blutbalken', 'roter waagrechter Balken über die Augenpartie'),
  t('paint', 'gold', 'Goldlinien', 'feine goldene Linien von der Stirn über die Wangen'),
  t('eyes', 'augenklappe', 'Augenklappe', 'schwarze Leder-Augenklappe über dem linken Auge mit Band um den Kopf'),
  t('eyes', 'brille', 'Brille', 'kleine runde Brille mit dünnem Metallrahmen'),
];

export const traitFile = (tr: TraitDef) => `${TRAIT_CATEGORIES.find((c) => c.id === tr.category)!.file}_${tr.id}`;

/** Haar- und Bartfarben, mit denen die grauen Ebenen im Code eingefärbt werden. */
export const HAIR_COLORS = [
  { id: 'schwarz', label: 'Schwarz', hex: '#1d1a18' },
  { id: 'dunkelbraun', label: 'Dunkelbraun', hex: '#3b2a1e' },
  { id: 'braun', label: 'Braun', hex: '#6b4a2e' },
  { id: 'dunkelblond', label: 'Dunkelblond', hex: '#9a7a4c' },
  { id: 'blond', label: 'Blond', hex: '#d2b57a' },
  { id: 'rot', label: 'Rot', hex: '#8f3a1c' },
  { id: 'grau', label: 'Grau', hex: '#8d8a86' },
  { id: 'weiss', label: 'Weiß', hex: '#dcd8d0' },
];

/** Kopfbedeckungen, unter denen die Frisur ausgeblendet wird (Kränze, Diademe und Kronen lassen sie sichtbar). */
const SHOWS_HAIR = new Set(['lorbeerkranz-triumphator', 'traubenkrone', 'diadem-zirkel']);
export const helmetHidesHair = (i: ItemDef) => i.slot === 'head' && !SHOWS_HAIR.has(i.id);

/** Ausrüstungs-Ebene auf der Figur (zusätzlich zum Item-Icon). */
export const figureFile = (i: ItemDef) => `${itemFile(i)}_figur`;
export const HEAD_ITEMS = ITEMS.filter((i) => i.slot === 'head');
