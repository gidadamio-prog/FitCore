# Brillen/Augenklappen, Tattoos, Narben und Zusatz-Frisuren als Ebenen für den Ganzkörper-Helden.
# Tattoos und Narben liegen im „Schablonen-Rahmen“ (307 × 341, Rumpf/Arme/Beine gestaucht) und werden
# in der App je Körpertyp teilweise (Rumpf, 2 Arme, 2 Beine) auf die erkannten Körperbereiche gelegt.
# Aufruf: python3 scripts/traits/process_extras.py <augen.png> <augen2_mit_frisuren.png> <tattoos.png> <narbe_01.png> … <narbe_15.png>
import sys, os, glob
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
from process import hair_fit, CX  # noqa: E402

OUT = 'src/assets/rpg'
SCALE = 1.5

# ---------------------------------------------------------------------------
# Hilfen
# ---------------------------------------------------------------------------

def components_by_cell(a, row_bounds, cols):
    al = a[..., 3] > 8
    lab, _ = ndimage.label(al)
    W = al.shape[1]
    cells = {}
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab[sl] == i
        if m.sum() < 30: continue
        ys, xs = np.nonzero(m)
        cy, cx = ys.mean() + sl[0].start, xs.mean() + sl[1].start
        r = max(k for k in range(len(row_bounds) - 1) if cy >= row_bounds[k])
        cells.setdefault((r, int(cx / (W / cols))), []).append(i)
    out = {}
    for (r, c), ids in cells.items():
        mask = np.isin(lab, ids)
        ys, xs = np.nonzero(mask)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        p = a[y0:y1, x0:x1].copy()
        p[..., 3] = np.where(mask[y0:y1, x0:x1], p[..., 3], 0)
        out[f'{r}{c}'] = p
    return out

def save(arr, file, size):
    Image.fromarray(arr).resize(size, Image.LANCZOS).save(f'{OUT}/{file}.webp', quality=88, method=6)

def gray(a):
    f = a.astype(float)
    lum = 0.299 * f[..., 0] + 0.587 * f[..., 1] + 0.114 * f[..., 2]
    vis = a[..., 3] > 128
    lo, hi = np.percentile(lum[vis], 2), np.percentile(lum[vis], 98)
    t = np.clip((lum - lo) / max(1, hi - lo), 0, 1)
    return np.dstack([(t * 255).astype(np.uint8)] * 3 + [a[..., 3]])

head = {}

# ---------------------------------------------------------------------------
# Brillen & Augenklappen (Blatt 1, 3 × 4)
# ---------------------------------------------------------------------------
EYES = {
    '00': ('drahtbrille', {}), '01': ('rundbrille', {}), '02': ('hornbrille', {}), '10': ('pilotenbrille', {}),
    '11': ('monokel', {'w': 72, 'ax': 0.3, 'ay': 0.24, 'tx': 406}), '12': ('augenklappe', {'w': 86, 'ty': 129, 'tx': 388}),
    '20': ('lederklappe', {'w': 86, 'ty': 130, 'tx': 381}), '21': ('schildklappe', {'w': 88, 'ty': 131}), '22': ('uhrwerkklappe', {'w': 92, 'ty': 130}),
    '30': ('visier', {'w': 98, 'ty': 131}), '31': ('schutzbrille', {'w': 96}), '32': ('kaisermaske', {'w': 96, 'ty': 127}),
}
CLEAR = {'00', '01', '02', '11', '31'}  # Gläser durchsichtig machen

def eyes(path):
    a = np.array(Image.open(path).convert('RGBA'))
    for cell, p in components_by_cell(a, [0, 384, 768, 1152, 1537], 3).items():
        if cell not in EYES: continue
        name, o = EYES[cell]
        if cell in CLEAR:
            f = p.astype(float) / 255
            mx, mn = f[..., :3].max(-1), f[..., :3].min(-1)
            lens = (mx > 0.55) & ((mx - mn) < 0.12)
            p[..., 3] = np.where(lens, np.minimum(p[..., 3], 45), p[..., 3])
        h, w = p.shape[:2]
        s = o.get('w', 94) / w
        x = o.get('tx', CX) - o.get('ax', 0.5) * w * s
        y = o.get('ty', 131) - o.get('ay', 0.5) * h * s
        file = f'augen_{name}'
        save(p, file, (round(w * s * SCALE), round(h * s * SCALE)))
        head[file] = [round(x / 768 * 100, 2), round(y / 1152 * 100, 2), round(w * s / 768 * 100, 2), False]

# ---------------------------------------------------------------------------
# Zusatz-Frisuren (Blatt 2, Reihe 2)
# ---------------------------------------------------------------------------
HAIR2 = {'10': 'zerzaust', '11': 'fransen', '12': 'wuschel'}
OVER2 = {'11': {'k': 0.8, 'dy': 5}, '12': {'k': 0.8, 'dy': 5}}

def hair2(path):
    a = np.array(Image.open(path).convert('RGBA'))
    for cell, p in components_by_cell(a, [0, 560, 850, 1150, 1537], 3).items():
        if cell not in HAIR2: continue
        f = hair_fit(p)
        o = OVER2.get(cell, {})
        sc = f['s'] * o.get('k', 1)
        h, w = p.shape[:2]
        x = CX - f['ax'] * sc
        y = f['ty'] - f['ay'] * sc + o.get('dy', 0)
        file = f'frisur_{HAIR2[cell]}'
        save(gray(p), file, (round(w * sc * SCALE), round(h * sc * SCALE)))
        head[file] = [round(x / 768 * 100, 2), round(y / 1152 * 100, 2), round(w * sc / 768 * 100, 2), False]

# ---------------------------------------------------------------------------
# Tattoos (5 × 3 Schablonen-Zellen) und Narben (je eine Schablonen-Zelle)
# ---------------------------------------------------------------------------
TATTOOS = ['lorbeer', 'kampfbaender', 'schlange', 'sol', 'saeule', 'adler', 'glutadern', 'zenturio', 'flammen', 'nordstern',
           'lichtadern', 'dornen', 'loewe', 'runen', 'blutstreifen']
SCARS = ['wange', 'brustnaht', 'baerenkralle', 'hiebe', 'blitz', 'greifenkrallen', 'brand', 'schenkelhieb', 'vierfachhieb',
         'kratzer', 'auge', 'doppelnaht', 'schulterkralle', 'langer-schnitt', 'unterarm']
scar_aspect = {}

def tattoos(path):
    a = np.array(Image.open(path).convert('RGBA'))
    H, W = a.shape[:2]
    for k, name in enumerate(TATTOOS):
        r, c = divmod(k, 5)
        x0, y0 = round(c * W / 5), round(r * H / 3)
        cell = a[y0:y0 + 341, x0:x0 + 307]
        Image.fromarray(cell).resize((320, 356), Image.LANCZOS).save(f'{OUT}/tattoo_{name}.webp', quality=74, method=6)

def scars(paths):
    for name, path in zip(SCARS, paths):
        a = np.array(Image.open(path).convert('RGBA'))
        ys, xs = np.nonzero(a[..., 3] > 20)
        p = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        h, w = p.shape[:2]
        f = 1.2
        save(p, f'narbe_{name}', (round(w * f), round(h * f)))
        scar_aspect[name] = round(h / w, 3)

# ---------------------------------------------------------------------------
# Körperbereiche je Grundkörper (aus der Silhouette)
# ---------------------------------------------------------------------------

def runs(r):
    d = np.diff(np.concatenate([[0], r.astype(int), [0]]))
    return [(int(s), int(e)) for s, e in zip(np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]) if e - s > 3]

def frames(path):
    m = np.array(Image.open(path).convert('RGBA'))[..., 3] > 100
    top = next(y for y in range(200, 400) if np.ptp(np.nonzero(m[y])[0]) > 240)
    xs = np.nonzero(m[top + 60])[0]
    sL, sR = int(xs.min()), int(xs.max())
    armL, armR = [], []
    for y in range(top + 40, 720, 4):
        rs = runs(m[y])
        if len(rs) >= 3: armL.append((y, rs[0])); armR.append((y, rs[-1]))
    aLx0 = min(r[0] for _, r in armL); aRx1 = max(r[1] for _, r in armR); aY1 = max(y for y, _ in armL)
    rs = runs(m[880]); lL, lR = rs[0], rs[-1]
    legs_top = next(y for y in range(650, 900) if len([r for r in runs(m[y]) if r[1] < 384 or r[0] > 384]) >= 2 and not any(r[0] <= 384 <= r[1] for r in runs(m[y])))
    feet = int(np.nonzero(m.any(1))[0].max())
    W = sR - sL
    lw, rw = lL[1] - lL[0], lR[1] - lR[0]
    box = {
        'torso': [sL + 0.1 * W, top - 15, sR - 0.1 * W, top - 15 + 0.58 * (legs_top - top)],
        'armL': [aLx0, top, sL + 0.18 * W, aY1], 'armR': [sR - 0.18 * W, top, aRx1, aY1],
        'legL': [lL[0] - 0.08 * lw, legs_top, lL[1] + 0.08 * lw, feet - 25], 'legR': [lR[0] - 0.08 * rw, legs_top, lR[1] + 0.08 * rw, feet - 25],
    }
    return {k: [round(v[0] / 768 * 100, 2), round(v[1] / 1152 * 100, 2), round((v[2] - v[0]) / 768 * 100, 2), round((v[3] - v[1]) / 1152 * 100, 2)] for k, v in box.items()}

if __name__ == '__main__':
    eyes(sys.argv[1])
    hair2(sys.argv[2])
    tattoos(sys.argv[3])
    scars(sys.argv[4:19])
    bodies = {os.path.basename(f)[8:-5]: frames(f) for f in sorted(glob.glob(f'{OUT}/koerper_*.webp'))}
    L = ['// Generiert von scripts/traits/process_extras.py.',
         '// Kopf-Ebenen: [links %, oben %, Breite %, Schmuck-Ebene]',
         'export const HEAD_LAYOUT_EXTRA: Record<string, [number, number, number, boolean]> = {']
    L += [f"  '{k}': [{', '.join(str(v).lower() for v in head[k])}]," for k in sorted(head)]
    L += ['};', '', '// Körperbereiche je Grundkörper: [links %, oben %, Breite %, Höhe %] im 2:3-Kasten',
          "export type BodyPart = 'torso' | 'armL' | 'armR' | 'legL' | 'legR';",
          'export const BODY_PARTS: Record<string, Record<BodyPart, [number, number, number, number]>> = {']
    for b, parts in bodies.items():
        L.append(f"  '{b}': {{ " + ', '.join(f'{k}: [{", ".join(map(str, v))}]' for k, v in parts.items()) + ' },')
    L += ['};', '', '// Seitenverhältnis (Höhe/Breite) der Narben-Bilder',
          'export const SCAR_ASPECT: Record<string, number> = {']
    L += [f"  '{k}': {v}," for k, v in scar_aspect.items()]
    L += ['};']
    open('src/domain/bodyLayout.ts', 'w').write('\n'.join(L) + '\n')
    print(len(head), 'Kopf-Ebenen,', len(bodies), 'Körper')
