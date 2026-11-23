# FitCore – Grafik-Briefing

Alle Grafiken für Held, Ausrüstung und Gegner. Die App läuft schon komplett mit gezeichneten Platzhaltern; jedes gelieferte Bild ersetzt automatisch seinen Platzhalter. Schick die Bilder einfach paketweise als ZIP in den Chat.

**Pflicht: 64 Bilder** (20 Porträts, 23 Start-Ausrüstung, 21 Achievement-Ausrüstung). **Optional: 25 Gegner-Porträts.**

## Regeln für alle Bilder

| | Item-Icons | Heldenporträts | Gegner (optional) |
| --- | --- | --- | --- |
| Format | PNG mit Transparenz | PNG mit Transparenz | PNG |
| Größe | 512 × 512 px | 1024 × 1280 px (4:5) | 768 × 768 px |
| Motiv | ein Gegenstand, mittig, ca. 8 % Rand | Brustbild bis Hüfte, leicht nach rechts gedreht | Kopf und Schultern |
| Hintergrund | keiner | keiner | darf, dunkel und schlicht |
| Nicht enthalten | Rahmen, Text, Funken, Glow, Bodenschatten | Waffe, Schild, Helm, Handschuhe (kommen aus den Slots) | Text, Lebensbalken |

1. **Stil:** handgemalter Fantasy-RPG-Look wie WoW- oder Diablo-Icons, römisch-kaiserlich; Farbwelt Purpur, Gold, Schwarz, Marmor wie das Konstantyn-Bild.
2. **Licht** immer von oben links. **Waffen** diagonal von unten links nach oben rechts, Rüstungsteile frontal.
3. **Lesbar bei 48 px:** klare Silhouette, keine feinen Details am Rand.
4. **Keine Effekte malen** (Funken, Wasser, Flammen …) – die animiere ich im Code. Rahmen und Seltenheitsfarbe kommen ebenfalls aus dem Code.
5. **Porträts:** pro Klasse dieselbe Person, gleiche Pose, gleicher Bildausschnitt in allen 5 Stufen – nur Kleidung und Ausstrahlung werden prächtiger.
6. **Dateinamen exakt wie unten** (Kleinbuchstaben, Bindestriche, keine Umlaute). Größe egal, ich komprimiere.

### Vorlagen für KI-Bildgeneratoren

Item-Icon (nur die eckigen Klammern tauschen):

```text
Game item icon of [MOTIV], hand-painted fantasy RPG icon style like World of Warcraft,
Roman imperial theme, crimson, gold, black and marble accents, single object centered,
light from top left, clean silhouette, transparent background,
no frame, no text, no glow, no particles, no ground shadow
```

Porträt:

```text
Half-body portrait of [PERSON], wearing [KLEIDUNG DER STUFE], no helmet, no weapon, no shield,
3/4 view facing slightly right, same pose and framing as the reference, hand-painted fantasy RPG style,
crimson and gold palette, transparent background, no text
```

Tipp: Erst Stufe 1 erzeugen, dann für Stufe 2–5 dieses Bild als Referenz mitgeben („same person, same pose“), damit es dieselbe Figur bleibt.

## 0. Ganzkörper-Held in Ebenen

Der Held besteht aus Ebenen, die exakt übereinanderliegen: **Grundkörper → Merkmale (Haare, Augen, Narben, Brille …) → Ausrüstung**. Der Körper folgt den Körperwerten, nicht dem Rang.

**Raster für alle Ebenen:** 1024 × 1536 px (2:3), transparenter Hintergrund, Figur frontal und mittig, Kopfoberkante bei ca. y = 90 px, Kopfmitte bei x = 511 px. Am einfachsten einen Grundkörper als Referenz mitgeben („same canvas, same position“) und nur das neue Element malen.

**Grundkörper – geliefert (12/12):**

- [x] `koerper_duenn.webp` – Dünn
- [x] `koerper_schlank.webp` – Schlank
- [x] `koerper_durchschnitt.webp` – Durchschnitt
- [x] `koerper_uebergewichtig.webp` – Übergewichtig
- [x] `koerper_adipoes.webp` – Adipös
- [x] `koerper_fit.webp` – Fit
- [x] `koerper_athletisch.webp` – Athletisch
- [x] `koerper_kraeftig.webp` – Kräftig
- [x] `koerper_muskuloes-bauch.webp` – Muskulös mit Bauch
- [x] `koerper_bodybuilder.webp` – Bodybuilder
- [x] `koerper_strongman.webp` – Strongman
- [x] `koerper_koloss.webp` – Koloss

## 1. Testlauf zuerst (2 Bilder)

Damit legen wir den Stil fest, bevor du den Rest machst.

- [ ] `portraet_legionaer_stufe1.png` – kräftiger Legionär, kurzes dunkles Haar, kantiges Kinn; einfache, abgetragene Tunika, barfuß wirkend, unsicherer Blick, zerzaustes Haar
- [ ] `haupthand_gladius-bestleistung.png` – prunkvoller Gladius mit Goldgriff

## 2. Heldenporträts (20 Bilder: 4 Klassen × 5 Stufen)

Das Erscheinungsbild wächst mit dem Rang: Stufe 1 = Tiro/Miles … Stufe 5 = Legatus/Imperator.

| Stufe | Ränge | Kleidung und Ausstrahlung |
| --- | --- | --- |
| 1 · Rekrut | Tiro, Miles | einfache, abgetragene Tunika, barfuß wirkend, unsicherer Blick, zerzaustes Haar |
| 2 · Soldat | Decanus, Signifer | saubere Tunika mit Lederweste, ordentlicher Haarschnitt, entschlossener Blick |
| 3 · Veteran | Optio, Centurio | Kettenhemd über der Tunika, erste Narben, selbstbewusst |
| 4 · Offizier | Primus Pilus, Tribunus | Prunk-Schuppenpanzer, roter Umhang mit Fibel, markante Züge |
| 5 · Imperator | Legatus, Imperator | Purpurmantel mit Goldstickerei, goldene Details, leichte goldene Aura |

**Legionär** – kräftiger Legionär, kurzes dunkles Haar, kantiges Kinn

- `portraet_legionaer_stufe1.png` – siehe Testlauf oben
- [ ] `portraet_legionaer_stufe2.png` – Stufe 2 (Soldat)
- [ ] `portraet_legionaer_stufe3.png` – Stufe 3 (Veteran)
- [ ] `portraet_legionaer_stufe4.png` – Stufe 4 (Offizier)
- [ ] `portraet_legionaer_stufe5.png` – Stufe 5 (Imperator)

**Gladiator** – muskulöser Gladiator, rasierter Kopf, Narben an den Armen

- [ ] `portraet_gladiator_stufe1.png` – Stufe 1 (Rekrut)
- [ ] `portraet_gladiator_stufe2.png` – Stufe 2 (Soldat)
- [ ] `portraet_gladiator_stufe3.png` – Stufe 3 (Veteran)
- [ ] `portraet_gladiator_stufe4.png` – Stufe 4 (Offizier)
- [ ] `portraet_gladiator_stufe5.png` – Stufe 5 (Imperator)

**Cursor** – schlanker, drahtiger Bote, lockiges Haar, wacher Blick

- [ ] `portraet_cursor_stufe1.png` – Stufe 1 (Rekrut)
- [ ] `portraet_cursor_stufe2.png` – Stufe 2 (Soldat)
- [ ] `portraet_cursor_stufe3.png` – Stufe 3 (Veteran)
- [ ] `portraet_cursor_stufe4.png` – Stufe 4 (Offizier)
- [ ] `portraet_cursor_stufe5.png` – Stufe 5 (Imperator)

**Stratege** – älterer Feldherr, grau melierter kurzer Bart, ruhiger Blick

- [ ] `portraet_stratege_stufe1.png` – Stufe 1 (Rekrut)
- [ ] `portraet_stratege_stufe2.png` – Stufe 2 (Soldat)
- [ ] `portraet_stratege_stufe3.png` – Stufe 3 (Veteran)
- [ ] `portraet_stratege_stufe4.png` – Stufe 4 (Offizier)
- [ ] `portraet_stratege_stufe5.png` – Stufe 5 (Imperator)

## 3. Start-Ausrüstung (23 Bilder)

Jede Klasse startet mit einem gewöhnlichen Set. Der Gladiator trägt eine Zweihandwaffe und hat deshalb keine Nebenhand.

**Legionär**

- [ ] `haupthand_gladius.png` – Gladius: schlichter Eisen-Gladius
- [ ] `nebenhand_scutum.png` – Scutum: roter Langschild mit Goldadler
- [ ] `helm_galea.png` – Galea: Legionärshelm mit Wangenklappen
- [ ] `haende_manicae.png` – Manicae: Armschienen aus Eisenstreifen
- [ ] `hose_bracae.png` – Bracae: Legionärshose aus Wolle
- [ ] `schuhe_caligae.png` – Caligae: genagelte Ledersandalen

**Gladiator**

- [ ] `haupthand_dreizack.png` – Dreizack: Dreizack des Retiarius (Zweihand)
- [ ] `helm_murmillo.png` – Murmillo-Helm: Murmillo-Helm mit Gitter und Kamm
- [ ] `haende_manica.png` – Manica: gepolsterter Armschutz
- [ ] `hose_subligaculum.png` – Subligaculum: Lendenschurz mit Ledergürtel
- [ ] `schuhe_fasciae.png` – Fasciae: Wickelbänder für die Beine

**Cursor**

- [ ] `haupthand_botenstab.png` – Botenstab: Botenstab mit Bronzekappe
- [ ] `nebenhand_depeschenrolle.png` – Depeschenrolle: versiegelte Schriftrolle
- [ ] `helm_petasos.png` – Petasos: breitkrempiger Reisehut
- [ ] `haende_lederhandschuhe.png` – Lederhandschuhe: leichte Lederhandschuhe
- [ ] `hose_laufhose.png` – Laufhose: leichte kurze Hose
- [ ] `schuhe_leichte-sandalen.png` – Leichte Sandalen: leichte Riemensandalen

**Stratege**

- [ ] `haupthand_kommandostab.png` – Kommandostab: Kommandostab (Vitis) mit Goldbeschlag
- [ ] `nebenhand_wachstafel.png` – Wachstafel: Wachstafel mit Griffel
- [ ] `helm_offiziershelm.png` – Offiziershelm: Helm mit querstehendem rotem Busch
- [ ] `haende_siegelring-handschuhe.png` – Siegelring-Handschuhe: feine Handschuhe mit Siegelring
- [ ] `hose_feldherren-beinkleid.png` – Feldherren-Beinkleid: edles Beinkleid mit Purpurstreifen
- [ ] `schuhe_calcei.png` – Calcei: geschnürte Lederstiefel

## 4. Achievement-Ausrüstung (21 Bilder, davon 1 im Testlauf)

Wird über Abzeichen freigeschaltet. Bronze/Silber/Gold verwenden dasselbe Bild; Rahmen und Effekt-Stärke wachsen im Code. Den Effekt in Klammern **nicht** malen – nur zur Info, damit das Motiv dazu passt.

- `haupthand_gladius-bestleistung.png` – Gladius der Bestleistung: prunkvoller Gladius mit Goldgriff _(Effekt: Funken sprühen von der Klinge)_ – siehe Testlauf oben
- [ ] `haupthand_hammer-atlas.png` – Hammer des Atlas: riesiger Steinhammer mit Atlas-Relief (Zweihand) _(Effekt: Bodenwelle, Steinchen hüpfen)_
- [ ] `haupthand_feder-chronist.png` – Feder des Chronisten: übergroße Schreibfeder als Waffe _(Effekt: Tintenkleckse tropfen)_
- [ ] `haupthand_kochloeffel-kaiser.png` – Kochlöffel des Kaisers: goldener Kochlöffel mit Lorbeergravur _(Effekt: Dampf und fliegende Kräuter)_
- [ ] `nebenhand_veteranenschild.png` – Veteranenschild: zerkratzter, geflügelter Rundschild _(Effekt: Glanzlicht wandert übers Metall)_
- [ ] `nebenhand_amphore-aquaedukt.png` – Amphore des Aquädukts: bauchige Amphore mit Wellenmuster _(Effekt: Wasser schwappt, Tropfen fallen)_
- [ ] `nebenhand_waage-punktlandung.png` – Waage der Punktlandung: bronzene Balkenwaage _(Effekt: Schalen pendeln exakt ein)_
- [ ] `nebenhand_phoenixfackel.png` – Phönixfackel: Fackel mit Phönixkopf _(Effekt: Flammen und aufsteigende Funken)_
- [ ] `nebenhand_hantelscheiben-schild.png` – Hantelscheiben-Schild: Hantelscheibe als Schild mit Griff _(Effekt: Scheibe dreht sich, Metallglanz)_
- [ ] `helm_galea-feldherr.png` – Galea des Feldherrn: Prunkhelm mit hohem rotem Busch _(Effekt: Roter Helmbusch weht)_
- [ ] `helm_lorbeerkranz-triumphator.png` – Lorbeerkranz des Triumphators: goldener Lorbeerkranz _(Effekt: Goldene Blätter rieseln)_
- [ ] `helm_traubenkrone.png` – Traubenkrone: Krone aus Weinlaub und Trauben _(Effekt: Trauben wippen und kullern)_
- [ ] `helm_diadem-zirkel.png` – Diadem des Zirkels: schlichtes Stirnband mit kleinen Edelsteinen _(Effekt: Lichtpunkte kreisen wie ein Zirkel)_
- [ ] `haende_shaker-handschuhe.png` – Shaker-Handschuhe: Handschuhe mit Shaker-Motiv _(Effekt: Proteinpulver-Wölkchen)_
- [ ] `haende_caesten-champion.png` – Caesten des Champions: Faustriemen mit Metallbeschlägen _(Effekt: Sandstaub-Einschlag)_
- [ ] `haende_kreidehaende.png` – Kreidehände des Meisters: Handschuhe, mit Kreide bestaubt _(Effekt: Kreidestaub rieselt)_
- [ ] `hose_massband-beinkleider.png` – Maßband-Beinkleider: Hose mit Maßband als Gürtel und Saum _(Effekt: Zentimeterzahlen schweben hoch)_
- [ ] `hose_beinschienen-eroberer.png` – Beinschienen des Eroberers: Beinschienen mit Provinzwappen _(Effekt: Provinzwappen leuchten auf)_
- [ ] `schuhe_caligae-laeufer.png` – Caligae des Läufers: Sandalen mit Flügel-Motiv _(Effekt: Staubspur und Speedlines)_
- [ ] `schuhe_marschstiefel-legion.png` – Marschstiefel der Legion: schwere Marschstiefel _(Effekt: Stampfen im Takt)_
- [ ] `schuhe_schattensandalen.png` – Schattensandalen: dunkle Sandalen mit Rauchschleier-Muster _(Effekt: Schattenbild läuft hinterher)_

## 5. Optional: Gegner (25 Bilder)

**Feldzugs-Bosse**

- [ ] `boss_vercingetorix.png` – Vercingetorix, Fürst der Arverner (Gallia)
- [ ] `boss_arminius.png` – Arminius, Schatten des Teutoburger Waldes (Germania)
- [ ] `boss_boudicca.png` – Boudicca, Königin der Icener (Britannia)
- [ ] `boss_viriathus.png` – Viriathus, Hirte und Rebell (Hispania)
- [ ] `boss_decebalus.png` – Decebalus, König der Daker (Dacia)
- [ ] `boss_iugurtha.png` – Iugurtha, König von Numidien (Africa)
- [ ] `boss_sobek.png` – Der Wächter von Sobek, Herr des Nils (Aegyptus)
- [ ] `boss_tiridates.png` – Tiridates, König der Berge (Armenia)
- [ ] `boss_surena.png` – Surena, Feldherr von Carrhae (Parthia)
- [ ] `boss_attila.png` – Attila, Geißel Gottes (Pannonia)
- [ ] `boss_schapur.png` – Schapur, König der Könige (Persis)
- [ ] `boss_maxentius.png` – Maxentius, Letzter Gegner Konstantins (Pons Milvius)
- [ ] `boss_barbarenheer.png` – Barbarenheer am Limes (endloser Feldzug)

**Kolosseum-Gladiatoren** (einer pro Monat)

- [ ] `gladiator_marcus-attilius.png` – Gladiator Marcus Attilius
- [ ] `gladiator_commodus.png` – Gladiator Commodus
- [ ] `gladiator_spiculus.png` – Gladiator Spiculus
- [ ] `gladiator_flamma.png` – Gladiator Flamma
- [ ] `gladiator_priscus.png` – Gladiator Priscus
- [ ] `gladiator_verus.png` – Gladiator Verus
- [ ] `gladiator_carpophorus.png` – Gladiator Carpophorus
- [ ] `gladiator_tetraites.png` – Gladiator Tetraites
- [ ] `gladiator_hermes.png` – Gladiator Hermes
- [ ] `gladiator_triumphus.png` – Gladiator Triumphus
- [ ] `gladiator_celadus.png` – Gladiator Celadus
- [ ] `gladiator_crescens.png` – Gladiator Crescens

## Klassen-Dateinamen

Legionär = `legionaer` · Gladiator = `gladiator` · Cursor = `cursor` · Stratege = `stratege`
