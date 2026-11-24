// Erzeugt GRAFIK_BRIEFING.md direkt aus dem Katalog – Dateinamen stimmen dadurch immer mit dem Code überein.
import { existsSync, writeFileSync } from 'node:fs';
import { APPEARANCE_STAGES, ITEMS, itemFile, portraitFile, CLASS_FILE } from '../src/domain/equipment';
import { CAMPAIGN, HERO_CLASSES, bossAt, bossFile, colosseumBossName } from '../src/domain/rpg';

const BOSS_LOOK: Record<string, string> = {
  gallia: 'gallischer Stammesfürst, wilde rotblonde Mähne, langer Schnurrbart, goldener Torques, karierter Umhang, Langschwert',
  germania: 'germanischer Cherusker-Fürst, Haar im Suebenknoten, Wolfsfell über den Schultern, Rundschild und Speer, kalter Blick',
  britannia: 'Kriegerkönigin der Icener, lange rote Haare, blaue Kriegsbemalung, goldener Torques, Speer, wehender Mantel',
  hispania: 'lusitanischer Hirte und Rebell, wettergegerbt, kurzer Bart, Ziegenfellumhang, Falcata-Schwert, kleiner Rundschild',
  dacia: 'Dakerkönig, Vollbart, phrygische Mütze, Schuppenpanzer, große Sichelwaffe (Falx), Drachenstandarte',
  africa: 'numidischer König, gelockter Bart, goldenes Diadem, weißer Mantel, Bündel Wurfspeere',
  aegyptus: 'Krieger mit Krokodilkopf, ägyptische Rüstung, breiter goldener Halskragen, Sichelschwert (Chepesch)',
  armenia: 'armenischer Bergkönig, hohe Tiara, schwerer Schuppenpanzer, Pelzmantel, Kriegsbeil',
  parthia: 'parthischer Feldherr, langer geölter Bart, Kataphrakt-Schuppenpanzer von Kopf bis Fuß, Reflexbogen',
  pannonia: 'Hunnenkönig, schmaler Bart, Pelzmütze, Lamellenpanzer, Kompositbogen auf dem Rücken, Säbel',
  persia: 'sasanidischer Großkönig, prunkvolle Zinnenkrone mit Kugel, langer gelockter Bart, Seidengewänder, Langschwert',
  'pons-milvius': 'römischer Usurpator-Kaiser als dunkles Spiegelbild des Helden: Lorbeerkranz, schwarzer Muskelpanzer, Purpurmantel, Gladius',
  limes: 'bulliger Barbarenkrieger, Bärenfell, Hörnerhelm, zweihändige Axt, Narben',
};
import { BODY_TYPES, bodyFile } from '../src/domain/bodyType';
import { TRAITS, TRAIT_CATEGORIES, traitFile } from '../src/domain/appearance';
const have = (f: string) => ['webp', 'png'].some((x) => existsSync(`src/assets/rpg/${f}.${x}`));

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
p('**Geliefert und eingebaut:** alle Merkmale und 36 Rüstungs-Sets (Kopf, Brust, Arme, Hose, Stiefel). **Als Nächstes dran:** Waffen und Schilde als Figur-Ebenen (Haupt-/Nebenhand). Icons: 20 Porträts. **Optional: 12 Gladiatoren-Porträts.**');
p();
p('## Regeln für alle Bilder');
p();
p('| | Item-Icons | Heldenporträts | Bosse (Kampfszene) |');
p('| --- | --- | --- | --- |');
p('| Format | PNG mit Transparenz | PNG mit Transparenz | PNG mit Transparenz |');
p('| Größe | 512 × 512 px | 1024 × 1280 px (4:5) | 1024 × 1536 px (2:3) |');
p('| Motiv | ein Gegenstand, mittig, ca. 8 % Rand | Brustbild bis Hüfte, leicht nach rechts gedreht | mind. ab Hüfte aufwärts, Blickrichtung egal (wird gespiegelt) |');
p('| Hintergrund | keiner | keiner | keiner |');
p('| Nicht enthalten | Rahmen, Text, Funken, Glow, Bodenschatten | Waffe, Schild, Helm, Handschuhe (kommen aus den Slots) | Text, Lebensbalken, Effekte, Bodenschatten |');
p();
p('1. **Stil:** Dark-Fantasy-Anime/Manhwa wie das Konstantyn-Bild und die Grundkörper, römisch-kaiserlich; Farbwelt Purpur, Gold, Schwarz, Marmor.');
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
p('Game item icon of [MOTIV], dark fantasy anime / manhwa game icon style,');
p('Roman imperial theme, crimson, gold, black and marble accents, single object centered,');
p('light from top left, clean silhouette, transparent background,');
p('no frame, no text, no glow, no particles, no ground shadow');
p('```');
p();
p('Porträt:');
p();
p('```text');
p('Half-body portrait of [PERSON], wearing [KLEIDUNG DER STUFE], no helmet, no weapon, no shield,');
p('3/4 view facing slightly right, same pose and framing as the reference, dark fantasy anime / manhwa style,');
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
p('### Merkmale (Ebene über dem Körper)');
p();
p('Jedes Merkmal ist **eine eigene Datei, die nur das Merkmal zeigt** – alles andere transparent. Haare und Bärte bitte **in neutralem hellem Grau** malen (mit normaler Schattierung): Ich färbe sie im Code ein, dadurch gibt es jede Frisur in allen Haarfarben, ohne dass du sie mehrfach erzeugen musst. Glatze = keine Frisur gewählt, dafür braucht es kein Bild.');
p();
p('**So bekommst du saubere Ebenen:**');
p();
p('1. `koerper_athletisch.webp` als Referenz anhängen.');
p('2. Prompt unten nutzen: erst den Kopf **mit** Merkmal auf dem Körper erzeugen lassen.');
p('3. Dann im selben Chat: „Now remove everything except the [MERKMAL] – keep its exact position and size, transparent background.“');
p('4. Kurzer Check: Bild über den Grundkörper legen – sitzt es auf Stirn/Kinn/Auge, passt es auf alle 12 Körper (die Köpfe liegen pixelgenau übereinander).');
p();
p('```text');
p('Same character, same canvas (1024x1536), same pose and exact head position as the reference.');
p('Add only: [MERKMAL]. Nothing else changes.');
p('Then output ONLY the [MERKMAL] as an isolated layer on a fully transparent background,');
p('exact same position and scale as on the character, [HINWEIS]. No body, no face, no text.');
p('```');
p();
for (const c of TRAIT_CATEGORIES) {
  const list = TRAITS.filter((x) => x.category === c.id);
  if (list.every((tr) => have(traitFile(tr)))) {
    p(`**${c.label}** – geliefert (${list.length}/${list.length}), eingebaut mit Freischaltungen`);
    p();
    continue;
  }
  p(`**${c.label}** – ${c.hint}`);
  p();
  for (const tr of list) p(`- [${have(traitFile(tr)) ? 'x' : ' '}] \`${traitFile(tr)}.png\` – ${tr.name}${tr.motif ? `: ${tr.motif}` : ''}`);
  p();
}
p('### Rüstung auf der Figur');
p();
p('Geliefert: 36 Sets (10 Stoff, 10 Leder, 10 Schwer, 6 Boss) je Kopf, Brust, Arme (Paar), Hose, Stiefel (Paar). Für weitere Sets genauso: **ein Sammelbild je Teil-Art, 6 × 6 Raster, frontal, transparenter Hintergrund**; Arme als Paar nebeneinander (links/rechts aus Sicht des Betrachters), Stiefel als Paar in einer Zelle. Zerlegt und eingepasst wird automatisch (`scripts/armor/process.py`).');
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
p('## 5. Bosse für die Kampfszene (13 Bilder)');
p();
p('Der aktuelle Boss steht groß auf dem Dashboard und kämpft nach jedem Training und jeder abgeschlossenen Mahlzeit gegen den Held. **Mindestens ab der Hüfte aufwärts** (unten abgeschnitten ist ok, wird weich ausgeblendet), **Blickrichtung egal** – ich spiegle so, dass der Boss nach links zum Helden schaut. Ohne Bild erscheint eine gezeichnete Silhouette.');
p();
p('Tipp: einen Grundkörper (z. B. `koerper_athletisch`) als Referenz mitgeben, dann passen Stil, Licht und Größe zum Helden. Bosse dürfen ruhig größer und wuchtiger wirken.');
p();
p('```text');
p('Character art of [BOSS], at least from the hips up, ready-to-fight pose, 3/4 view,');
p('dark fantasy anime / manhwa style matching the reference, light from top left,');
p('portrait canvas (e.g. 1024x1536), head with a small margin to the top edge,');
p('transparent background, no text, no ground shadow, no particles or glow');
p('```');
p();
for (const b of [...CAMPAIGN, bossAt(CAMPAIGN.length)]) {
  const have = ['webp', 'png'].some((x) => existsSync(`src/assets/rpg/${bossFile(b)}.${x}`));
  p(`- [${have ? 'x' : ' '}] \`${bossFile(b)}.png\` – **${b.id.startsWith('limes') ? 'Barbarenheer am Limes' : b.name}**, ${b.id.startsWith('limes') ? 'endloser Feldzug' : `${b.epithet} (${b.province})`}: ${BOSS_LOOK[b.id.startsWith('limes') ? 'limes' : b.id]}`);
}
p();
p('## 6. Optional: Gladiatoren (12 Bilder)');
p();
p('Kopf und Schultern, 768 × 768 px, Hintergrund darf dunkel und schlicht sein.');
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
