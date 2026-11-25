# FitCore – Grafik-Briefing

Alle Grafiken für Held, Ausrüstung und Gegner. Die App läuft schon komplett mit gezeichneten Platzhaltern; jedes gelieferte Bild ersetzt automatisch seinen Platzhalter. Schick die Bilder einfach paketweise als ZIP in den Chat.

**Geliefert und eingebaut:** alle Merkmale und 36 Rüstungs-Sets (Kopf, Brust, Arme, Hose, Stiefel). **Als Nächstes dran:** Waffen und Schilde als Figur-Ebenen (Haupt-/Nebenhand). Icons: 20 Porträts. **Optional: 12 Gladiatoren-Porträts.**

## Regeln für alle Bilder

| | Item-Icons | Heldenporträts | Bosse (Kampfszene) |
| --- | --- | --- | --- |
| Format | PNG mit Transparenz | PNG mit Transparenz | PNG mit Transparenz |
| Größe | 512 × 512 px | 1024 × 1280 px (4:5) | 1024 × 1536 px (2:3) |
| Motiv | ein Gegenstand, mittig, ca. 8 % Rand | Brustbild bis Hüfte, leicht nach rechts gedreht | mind. ab Hüfte aufwärts, Blickrichtung egal (wird gespiegelt) |
| Hintergrund | keiner | keiner | keiner |
| Nicht enthalten | Rahmen, Text, Funken, Glow, Bodenschatten | Waffe, Schild, Helm, Handschuhe (kommen aus den Slots) | Text, Lebensbalken, Effekte, Bodenschatten |

1. **Stil:** Dark-Fantasy-Anime/Manhwa wie das Konstantyn-Bild und die Grundkörper, römisch-kaiserlich; Farbwelt Purpur, Gold, Schwarz, Marmor.
2. **Licht** immer von oben links. **Waffen** diagonal von unten links nach oben rechts, Rüstungsteile frontal.
3. **Lesbar bei 48 px:** klare Silhouette, keine feinen Details am Rand.
4. **Keine Effekte malen** (Funken, Wasser, Flammen …) – die animiere ich im Code. Rahmen und Seltenheitsfarbe kommen ebenfalls aus dem Code.
5. **Porträts:** pro Klasse dieselbe Person, gleiche Pose, gleicher Bildausschnitt in allen 5 Stufen – nur Kleidung und Ausstrahlung werden prächtiger.
6. **Dateinamen exakt wie unten** (Kleinbuchstaben, Bindestriche, keine Umlaute). Größe egal, ich komprimiere.

### Vorlagen für KI-Bildgeneratoren

Item-Icon (nur die eckigen Klammern tauschen):

```text
Game item icon of [MOTIV], dark fantasy anime / manhwa game icon style,
Roman imperial theme, crimson, gold, black and marble accents, single object centered,
light from top left, clean silhouette, transparent background,
no frame, no text, no glow, no particles, no ground shadow
```

Porträt:

```text
Half-body portrait of [PERSON], wearing [KLEIDUNG DER STUFE], no helmet, no weapon, no shield,
3/4 view facing slightly right, same pose and framing as the reference, dark fantasy anime / manhwa style,
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

### Merkmale (Ebene über dem Körper)

Jedes Merkmal ist **eine eigene Datei, die nur das Merkmal zeigt** – alles andere transparent. Haare und Bärte bitte **in neutralem hellem Grau** malen (mit normaler Schattierung): Ich färbe sie im Code ein, dadurch gibt es jede Frisur in allen Haarfarben, ohne dass du sie mehrfach erzeugen musst. Glatze = keine Frisur gewählt, dafür braucht es kein Bild.

**So bekommst du saubere Ebenen:**

1. `koerper_athletisch.webp` als Referenz anhängen.
2. Prompt unten nutzen: erst den Kopf **mit** Merkmal auf dem Körper erzeugen lassen.
3. Dann im selben Chat: „Now remove everything except the [MERKMAL] – keep its exact position and size, transparent background.“
4. Kurzer Check: Bild über den Grundkörper legen – sitzt es auf Stirn/Kinn/Auge, passt es auf alle 12 Körper (die Köpfe liegen pixelgenau übereinander).

```text
Same character, same canvas (1024x1536), same pose and exact head position as the reference.
Add only: [MERKMAL]. Nothing else changes.
Then output ONLY the [MERKMAL] as an isolated layer on a fully transparent background,
exact same position and scale as on the character, [HINWEIS]. No body, no face, no text.
```

**Frisur** – geliefert (27/27), eingebaut mit Freischaltungen

**Bart** – geliefert (23/23), eingebaut mit Freischaltungen

**Narbe** – geliefert (15/15), eingebaut mit Freischaltungen

**Tattoo** – geliefert (15/15), eingebaut mit Freischaltungen

**Brille & Augenklappe** – geliefert (12/12), eingebaut mit Freischaltungen

### Rüstung auf der Figur

Geliefert: 36 Sets (10 Stoff, 10 Leder, 10 Schwer, 6 Boss) je Kopf, Brust, Arme (Paar), Hose, Stiefel (Paar). Für weitere Sets genauso: **ein Sammelbild je Teil-Art, 6 × 6 Raster, frontal, transparenter Hintergrund**; Arme als Paar nebeneinander (links/rechts aus Sicht des Betrachters), Stiefel als Paar in einer Zelle. Zerlegt und eingepasst wird automatisch (`scripts/armor/process.py`).

## 1. Testlauf zuerst (2 Bilder)

Damit legen wir den Stil fest, bevor du den Rest machst.

- [ ] `portraet_legionaer_stufe1.png` – kräftiger Legionär, kurzes dunkles Haar, kantiges Kinn; einfache, abgetragene Tunika, barfuß wirkend, unsicherer Blick, zerzaustes Haar
- [x] Waffen – geliefert (siehe Abschnitt 3)

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

## 3. Waffen (geliefert)

12 Waffenarten in Stufen plus 10 Boss-Waffen, zerlegt mit `scripts/weapons/process.py`. Für weitere Reihen: **ein Sammelbild je Art, Stufen nebeneinander, frontal, freigestellt**; Kampffäuste als Paar.

- [x] Schwert – 10 Stufen
- [x] Dolch – 10 Stufen
- [x] Beil – 5 Stufen
- [x] Streitkolben – 5 Stufen
- [x] Säbel – 5 Stufen
- [x] Kampffäuste – 10 Stufen (Zweihand)
- [x] Bogen – 5 Stufen (Zweihand)
- [x] Streitaxt – 5 Stufen (Zweihand)
- [x] Kriegshammer – 5 Stufen (Zweihand)
- [x] Stangenwaffe – 10 Stufen (Zweihand)
- [x] Schild – 10 Stufen
- [x] Foliant – 10 Stufen
- [x] Boss-Waffen – Klingenfächer der Pharaonin, Kettensichel von Numantia, Löwenkreis, Zepter des Palatiums, Horn des Etzel, Parthische Armbrust, Nebelklingen, Adlerflegel von Artaxata, Falx der Drachenberge, Siegel der Könige

## 5. Bosse für die Kampfszene (13 Bilder)

Der aktuelle Boss steht groß auf dem Dashboard und kämpft nach jedem Training und jeder abgeschlossenen Mahlzeit gegen den Held. **Mindestens ab der Hüfte aufwärts** (unten abgeschnitten ist ok, wird weich ausgeblendet), **Blickrichtung egal** – ich spiegle so, dass der Boss nach links zum Helden schaut. Ohne Bild erscheint eine gezeichnete Silhouette.

Tipp: einen Grundkörper (z. B. `koerper_athletisch`) als Referenz mitgeben, dann passen Stil, Licht und Größe zum Helden. Bosse dürfen ruhig größer und wuchtiger wirken.

```text
Character art of [BOSS], at least from the hips up, ready-to-fight pose, 3/4 view,
dark fantasy anime / manhwa style matching the reference, light from top left,
portrait canvas (e.g. 1024x1536), head with a small margin to the top edge,
transparent background, no text, no ground shadow, no particles or glow
```

- [x] `boss_vercingetorix.png` – **Vercingetorix**, Fürst der Arverner (Gallia): gallischer Stammesfürst, wilde rotblonde Mähne, langer Schnurrbart, goldener Torques, karierter Umhang, Langschwert
- [x] `boss_arminius.png` – **Arminius**, Schatten des Teutoburger Waldes (Germania): germanischer Cherusker-Fürst, Haar im Suebenknoten, Wolfsfell über den Schultern, Rundschild und Speer, kalter Blick
- [x] `boss_boudicca.png` – **Boudicca**, Königin der Icener (Britannia): Kriegerkönigin der Icener, lange rote Haare, blaue Kriegsbemalung, goldener Torques, Speer, wehender Mantel
- [x] `boss_viriathus.png` – **Viriathus**, Hirte und Rebell (Hispania): lusitanischer Hirte und Rebell, wettergegerbt, kurzer Bart, Ziegenfellumhang, Falcata-Schwert, kleiner Rundschild
- [x] `boss_decebalus.png` – **Decebalus**, König der Daker (Dacia): Dakerkönig, Vollbart, phrygische Mütze, Schuppenpanzer, große Sichelwaffe (Falx), Drachenstandarte
- [x] `boss_iugurtha.png` – **Iugurtha**, König von Numidien (Africa): numidischer König, gelockter Bart, goldenes Diadem, weißer Mantel, Bündel Wurfspeere
- [x] `boss_sobek.png` – **Der Wächter von Sobek**, Herr des Nils (Aegyptus): Krieger mit Krokodilkopf, ägyptische Rüstung, breiter goldener Halskragen, Sichelschwert (Chepesch)
- [x] `boss_tiridates.png` – **Tiridates**, König der Berge (Armenia): armenischer Bergkönig, hohe Tiara, schwerer Schuppenpanzer, Pelzmantel, Kriegsbeil
- [x] `boss_surena.png` – **Surena**, Feldherr von Carrhae (Parthia): parthischer Feldherr, langer geölter Bart, Kataphrakt-Schuppenpanzer von Kopf bis Fuß, Reflexbogen
- [x] `boss_attila.png` – **Attila**, Geißel Gottes (Pannonia): Hunnenkönig, schmaler Bart, Pelzmütze, Lamellenpanzer, Kompositbogen auf dem Rücken, Säbel
- [x] `boss_schapur.png` – **Schapur**, König der Könige (Persis): sasanidischer Großkönig, prunkvolle Zinnenkrone mit Kugel, langer gelockter Bart, Seidengewänder, Langschwert
- [x] `boss_maxentius.png` – **Maxentius**, Letzter Gegner Konstantins (Pons Milvius): römischer Usurpator-Kaiser als dunkles Spiegelbild des Helden: Lorbeerkranz, schwarzer Muskelpanzer, Purpurmantel, Gladius
- [ ] `boss_barbarenheer.png` – **Barbarenheer am Limes**, endloser Feldzug: bulliger Barbarenkrieger, Bärenfell, Hörnerhelm, zweihändige Axt, Narben

## 6. Optional: Gladiatoren (12 Bilder)

Kopf und Schultern, 768 × 768 px, Hintergrund darf dunkel und schlicht sein.

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
