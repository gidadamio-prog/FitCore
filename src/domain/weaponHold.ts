// Wie eine Waffe an der Figur sitzt. Alle Werte im 2:3-Kasten der Figur.
// gx/gy = Griffpunkt im Waffenbild (0–1), len = Bildhöhe in % der Kastenhöhe, ang = Drehung in Grad.
// Haupthand = Arm links im Bild (rechte Hand des Helden), Nebenhand = Arm rechts im Bild.
import { ARMOR_BODY } from './armorLayout';
import { weaponById, type WeaponInfo } from './weapons';

export type HoldMode = 'hand' | 'forearm' | 'fists';
export interface Hold {
  mode: HoldMode;
  gx: number;
  gy: number;
  len: number;
  ang: number;
  /** vor dem Arm (Schild) statt dahinter */
  front?: boolean;
  /** waagrecht spiegeln (Krümmung nach außen) */
  flip?: boolean;
}

const H = (gx: number, gy: number, len: number, ang: number, mode: HoldMode = 'hand', front = false): Hold => ({ mode, gx, gy, len, ang, front });

export const HOLD_BY_ART: Record<string, Hold> = {
  schwert: H(0.5, 0.86, 40, -16),
  dolch: H(0.5, 0.17, 21, 16),
  axt: H(0.62, 0.86, 25, -12),
  kolben: H(0.5, 0.86, 31, -18),
  saebel: { ...H(0.22, 0.9, 34, -10), flip: true },
  faust: H(0.5, 0.5, 0, 0, 'fists', true),
  bogen: H(0.62, 0.5, 46, -4),
  streitaxt: H(0.5, 0.64, 58, -6),
  kriegshammer: H(0.5, 0.64, 58, -6),
  stangenwaffe: H(0.5, 0.64, 80, -4),
  schild: H(0.5, 0.5, 35, 0, 'forearm', true),
  buch: H(0.5, 0.45, 14, 4, 'hand', true),
};

export const HOLD_BOSS: Hold[] = [
  H(0.55, 0.92, 22, -20), // Klingenfächer
  H(0.42, 0.55, 30, 0), // Kettensichel
  H(0.5, 0.92, 20, 0), // Löwenkreis (Chakram)
  H(0.5, 0.62, 52, -6), // Zepter (Ringstab)
  H(0.3, 0.75, 20, 0, 'hand', true), // Kriegshorn
  H(0.55, 0.75, 34, 0), // Armbrust
  H(0.5, 0.5, 26, 0), // Nebelklingen
  H(0.75, 0.55, 30, 0), // Adlerflegel
  H(0.5, 0.8, 40, -6), // Falx
  H(0.5, 0.5, 16, 0, 'hand', true), // Siegel der Könige
];

export const holdFor = (w: WeaponInfo): Hold => (w.boss ? HOLD_BOSS[w.boss.idx]! : HOLD_BY_ART[w.art]!);

/** Handpunkt (x %, y %) am unteren Ende des Unterarms. side L = Haupthand (links im Bild). */
export function handPoint(bodyId: string, side: 'L' | 'R'): { x: number; y: number; ang: number; w: number; cy: number; cx: number; len: number } | null {
  const a = ARMOR_BODY[bodyId]?.[side === 'L' ? 'armL' : 'armR'];
  if (!a) return null;
  const rad = (a.ang * Math.PI) / 180;
  // Abstand Mitte → Hand entlang der Armachse, in Einheiten der Kastenbreite (Höhe = 1,5 × Breite)
  const d = 0.38 * a.len * 1.5;
  return { x: a.cx - Math.sin(rad) * d, y: a.cy + (Math.cos(rad) * d) / 1.5, ang: a.ang, w: a.w, cx: a.cx, cy: a.cy, len: a.len };
}

export { weaponById };
