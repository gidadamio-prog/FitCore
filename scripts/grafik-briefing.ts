// Erzeugt GRAFIK_BRIEFING.md direkt aus dem Katalog – Dateinamen stimmen dadurch immer mit dem Code überein.
import { writeFileSync } from 'node:fs';
import { APPEARANCE_STAGES, ITEMS, itemFile, portraitFile, CLASS_FILE } from '../src/domain/equipment';
import { CAMPAIGN, HERO_CLASSES, colosseumBossName } from '../src/domain/rpg';
import { BODY_TYPES, bodyFile } from '../src/domain/bodyType';

const LOOK: Record<string, string> = {
  legionar: 'kräftiger Legionär, kurzes dunkles Haar, kantiges Kinn',
  gladiator: 'muskulöser Gladiator, rasierter Kopf, Narben an den Armen',
  cursor: 'schlanker, drahtiger Bote, lockiges Haar, wacher Blick',
  strategos: 'älterer Feldherr, grau melierter kurzer Bart, ruhiger Blick',
};
const out: string[] = [];
const p = (s = '') => out.push(s);

p('# FitCore – Grafik-Briefing');
p();
p('Alle Grafiken für Held, Ausrüstung und Gegner. Die App läuft schon komplett mit gezeichneten Platzhaltern; jedes gelieferte Bild ersetzt automatisch seinen Platzhalter. Schick die Bilder einfach paketweise als ZIP in den Chat.');
p();
p('**Pflicht: 64 Bilder** (20 Porträts, 23 Start-Ausrüstung, 21 Achievement-Ausrüstung). **Optional: 25 Gegner-Porträts.**');
p();
p('## Regeln für alle Bilder');
p();
p('| | Item-Icons | Heldenporträts | Gegner (optional) |');
p('| --- | --- | --- | --- |');
p('| Format | PNG mit Transparenz | PNG mit Transparenz | PNG |');
p('| Größe | 512 × 512 px | 1024 × 1280 px (4:5) | 768 × 768 px |');
p('| Motiv | ein Gegenstand, mittig, ca. 8 % Rand | Brustbild bis Hüfte, leicht nach rechts gedreht | Kopf und Schultern |');
p('| Hintergrund | keiner | keiner | darf, dunkel und schlicht |');
p('| Nicht enthalten | Rahmen, Text, Funken, Glow, Bodenschatten | Waffe, Schild, Helm, Handschuhe (kommen aus den Slots) | Text, Lebensbalken |');
p();
p('1. **Stil:** handgemalter Fantasy-RPG-Look wie WoW- oder Diablo-Icons, römisch-kaiserlich; Farbwelt Purpur, Gold, Schwarz, Marmor wie das Konstantyn-Bild.');
p('2. **Licht** immer von oben links. **Waffen** diagonal von unten links nach oben rechts, Rüstungsteile frontal.');
p('3. **Lesbar bei 48 px:** klare Silhouette, keine feinen Details am Rand.');
p('4. **Keine Effekte malen** (Funken, Wasser, Flammen …) – die animiere ich im Code. Rahmen und Seltenheitsfarbe kommen ebenfalls aus dem Code.');
p('5. **Porträts:** pro Klasse dieselbe Person, gleiche Pose, gleicher Bildausschnitt in allen 5 Stufen – nur Kleidung und Ausstrahlung werden prächtiger.');
p('6. **Dateinamen exakt wie unten** (Kleinbuchstaben, Bindestriche, keine Umlaute). Größe egal, ich komprimiere.');
p();
p('### Vorlagen für KI-Bildgeneratoren');
p();
p('Item-Icon (nur die eckigen Klammern tauschen):');
p();
p('```text');
p('Game item icon of [MOTIV], hand-painted fantasy RPG icon style like World of Warcraft,');
p('Roman imperial theme, crimson, gold, black and marble accents, single object centered,');
p('light from top left, clean silhouette, transparent background,');
p('no frame, no text, no glow, no particles, no ground shadow');
p('```');
p();
p('Porträt:');
p();
p('```text');
p('Half-body portrait of [PERSON], wearing [KLEIDUNG DER STUFE], no helmet, no weapon, no shield,');
p('3/4 view facing slightly right, same pose and framing as the reference, hand-painted fantasy RPG style,');
p('crimson and gold palette, transparent background, no text');
p('```');
p();
p('Tipp: Erst Stufe 1 erzeugen, dann für Stufe 2–5 dieses Bild als Referenz mitgeben („same person, same pose“), damit es dieselbe Figur bleibt.');
p();
p('## 0. Ganzkörper-Held in Ebenen');
p();
p('Der Held besteht aus Ebenen, die exakt übereinanderliegen: **Grundkörper → Merkmale (Haare, Augen, Narben, Brille …) → Ausrüstung**. Der Körper folgt den Körperwerten, nicht dem Rang.');
p();
p('**Raster für alle Ebenen:** 1024 × 1536 px (2:3), transparenter Hintergrund, Figur frontal und mittig, Kopfoberkante bei ca. y = 90 px, Kopfmitte bei x = 511 px. Am einfachsten einen Grundkörper als Referenz mitgeben („same canvas, same position“) und nur das neue Element malen.');
p();
p('**Grundkörper – geliefert (12/12):**');
p();
for (const b of BODY_TYPES) p(`- [x] \`${bodyFile(b.id)}.webp\` – ${b.label}`);
p();
p('## 1. Testlauf zuerst (2 Bilder)');
p();
p('Damit legen wir den Stil fest, bevor du den Rest machst.');
p();
p(`- [ ] \`${portraitFile('legionar', 1)}.png\` – ${LOOK.legionar}; ${APPEARANCE_STAGES[0].look}`);
const g = ITEMS.find((i) => i.id === 'gladius-bestleistung')!;
p(`- [ ] \`${itemFile(g)}.png\` – ${g.motif}`);
p();
p('## 2. Heldenporträts (20 Bilder: 4 Klassen × 5 Stufen)');
p();
p('Das Erscheinungsbild wächst mit dem Rang: Stufe 1 = Tiro/Miles … Stufe 5 = Legatus/Imperator.');
p();
p('| Stufe | Ränge | Kleidung und Ausstrahlung |');
p('| --- | --- | --- |');
const RANKN = ['Tiro', 'Miles', 'Decanus', 'Signifer', 'Optio', 'Centurio', 'Primus Pilus', 'Tribunus', 'Legatus', 'Imperator'];
for (const s of APPEARANCE_STAGES) p(`| ${s.stage} · ${s.name} | ${s.ranks.map((r) => RANKN[r - 1]).join(', ')} | ${s.look} |`);
p();
for (const c of HERO_CLASSES) {
  p(`**${c.name}** – ${LOOK[c.id]}`);
  p();
  for (const s of APPEARANCE_STAGES) {
    const f = portraitFile(c.id, s.stage);
    if (c.id === 'legionar' && s.stage === 1) p(`- \`${f}.png\` – siehe Testlauf oben`);
    else p(`- [ ] \`${f}.png\` – Stufe ${s.stage} (${s.name})`);
  }
  p();
}
p('## 3. Start-Ausrüstung (23 Bilder)');
p();
p('Jede Klasse startet mit einem gewöhnlichen Set. Der Gladiator trägt eine Zweihandwaffe und hat deshalb keine Nebenhand.');
p();
for (const c of HERO_CLASSES) {
  p(`**${c.name}**`);
  p();
  for (const i of ITEMS.filter((x) => x.source.kind === 'starter' && x.source.classId === c.id)) p(`- [ ] \`${itemFile(i)}.png\` – ${i.name}: ${i.motif}${i.twoHanded ? ' (Zweihand)' : ''}`);
  p();
}
p('## 4. Achievement-Ausrüstung (21 Bilder, davon 1 im Testlauf)');
p();
p('Wird über Abzeichen freigeschaltet. Bronze/Silber/Gold verwenden dasselbe Bild; Rahmen und Effekt-Stärke wachsen im Code. Den Effekt in Klammern **nicht** malen – nur zur Info, damit das Motiv dazu passt.');
p();
for (const i of ITEMS.filter((x) => x.source.kind === 'badge')) {
  const done = i.id === 'gladius-bestleistung';
  p(`- ${done ? '' : '[ ] '}\`${itemFile(i)}.png\` – ${i.name}: ${i.motif}${i.twoHanded ? ' (Zweihand)' : ''} _(Effekt: ${i.effectText})_${done ? ' – siehe Testlauf oben' : ''}`);
}
p();
p('## 5. Optional: Gegner (25 Bilder)');
p();
p('**Feldzugs-Bosse**');
p();
const bossFile = (name: string, id: string) => (id === 'aegyptus' ? 'sobek' : name.toLowerCase());
for (const b of CAMPAIGN) p(`- [ ] \`boss_${bossFile(b.name, b.id)}.png\` – ${b.name}, ${b.epithet} (${b.province})`);
p('- [ ] `boss_barbarenheer.png` – Barbarenheer am Limes (endloser Feldzug)');
p();
p('**Kolosseum-Gladiatoren** (einer pro Monat)');
p();
const names = new Set<string>();
for (let m = 1; m <= 12; m++) names.add(colosseumBossName(`2026-${String(m).padStart(2, '0')}`));
for (const n of names) p(`- [ ] \`gladiator_${n.toLowerCase().replace(/\s+/g, '-')}.png\` – Gladiator ${n}`);
p();
p('## Klassen-Dateinamen');
p();
p(Object.entries(CLASS_FILE).map(([k, v]) => `${HERO_CLASSES.find((c) => c.id === k)!.name} = \`${v}\``).join(' · '));
writeFileSync(process.argv[2] ?? 'GRAFIK_BRIEFING.md', out.join('\n') + '\n');
console.log('ok', out.length);
