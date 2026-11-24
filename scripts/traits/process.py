# Zerlegt die gelieferten Frisuren-/Bart-Sammelbilder in einzelne Ebenen, setzt sie auf den Kopf der
# Grundkörper (768 × 1152, Kopf in allen Körpern identisch) und speichert sie als graue, einfärbbare Ebene
# plus optionale Schmuck-Ebene (Ringe, Perlen – bleiben ungefärbt).
# Aufruf: python3 scripts/traits/process.py <frisuren1.png> <frisuren2.png> <baerte1.png> <baerte2.png>
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

OUT = 'src/assets/rpg'
SCALE = 1.5  # Pixel pro Einheit des 768er-Rasters
SHEETS = [('h1', 3, 5), ('h2', 3, 3), ('b1', 3, 5), ('b2', 3, 3)]

# Zelle im Sammelbild -> Merkmal-ID
IDS = {
    'h1_00': 'kurz', 'h1_01': 'scheitel', 'h1_02': 'rekrut', 'h1_10': 'zurueck', 'h1_11': 'struwwel', 'h1_12': 'locken',
    'h1_20': 'undercut', 'h1_21': 'sturm', 'h1_22': 'lang', 'h1_30': 'kasten', 'h1_31': 'dutt', 'h1_32': 'nackenzopf',
    'h1_40': 'wellenmaehne', 'h1_41': 'zoepfe', 'h1_42': 'windschnitt',
    'h2_00': 'tolle', 'h2_01': 'kamm', 'h2_02': 'flechtkrone', 'h2_10': 'seitenzopf', 'h2_11': 'wolfsmaehne', 'h2_12': 'wellen',
    'h2_20': 'wildlocken', 'h2_21': 'barbarendutt', 'h2_22': 'sturmscheitel',
    'b1_00': 'flaum', 'b1_01': 'dreitage', 'b1_02': 'kinnriemen', 'b1_10': 'vollbart', 'b1_11': 'backenbart', 'b1_12': 'kinnbart',
    'b1_20': 'zwirbel', 'b1_21': 'zwirbelzopf', 'b1_22': 'schnauzerbart', 'b1_30': 'zwirbelring', 'b1_32': 'kinnriemen-dicht',
    'b1_40': 'zwirbelspitz', 'b1_41': 'rauschebart', 'b1_42': 'ringzoepfe',
    'b2_00': 'zopfbart', 'b2_01': 'kriegsbart', 'b2_02': 'koenigsbart', 'b2_10': 'doppelzopf', 'b2_11': 'perlenbart', 'b2_12': 'zopfschnauzer',
    'b2_20': 'wildbart', 'b2_21': 'dreizopf', 'b2_22': 'spitzbart',
}
# Feinjustierung: ay/hw = Haaransatz bzw. Gesichtsbreite im Bild, k = Zusatzskalierung, dx/dy in 768er-Einheiten
OVER = {
    'h1_40': {'ay': 0.40, 'hw': 110, 'k': 0.88}, 'h2_00': {'ay': 0.55, 'hw': 115, 'k': 0.72}, 'h2_20': {'ay': 0.50, 'hw': 105, 'k': 0.74, 'dy': -3},
    'h2_21': {'ay': 0.44, 'hw': 112, 'k': 0.76}, 'h2_10': {'ay': 0.34, 'hw': 125, 'k': 0.8}, 'h1_21': {'ay': 0.62, 'hw': 107, 'k': 0.8},
    'b1_20': {'k': 0.92}, 'b1_21': {'k': 0.92}, 'b1_30': {'k': 0.92}, 'b1_40': {'k': 0.92}, 'b1_42': {'dy': 4},
}
SOFT = {'b1_00': 0.6, 'b1_01': 0.75}  # Stoppeln halb transparent
DECO = {'h2_10', 'h2_21', 'b1_21', 'b1_30', 'b1_42', 'b2_00', 'b2_02', 'b2_10', 'b2_11', 'b2_12', 'b2_21', 'b1_42'}

CX=384
def hair_fit(a):
    al=a[...,3]>40; H,W=al.shape
    # Loch: transparent, mit dem unteren Rand verbunden
    pad=np.pad(~al,((0,1),(0,0)),constant_values=True)
    lab,_=ndimage.label(pad); outside=lab==lab[-1,W//2]
    outside=outside[:-1]
    cx=W//2
    # Haaransatz Mitte: von unten hoch bis opak
    col=al[:,cx]; ys=np.nonzero(col)[0]
    # untere Kante der obersten opaken Strecke in der Mitte
    yh=ys[0]
    while yh+1<H and col[yh+1]: yh+=1
    row=yh+int(0.10*W)
    if row>=H: row=H-1
    r=al[row]; L=cx
    while L>0 and not r[L]: L-=1
    R=cx
    while R<W-1 and not r[R]: R+=1
    hw=max(R-L, W*0.5)
    s=78/hw
    return dict(s=s, ax=(L+R)/2, ay=yh, ty=99)
def beard_fit(a):
    al=a[...,3]>40; H,W=al.shape
    s=80/W
    holes,n=ndimage.label(~al)
    best=None
    for i,sl in enumerate(ndimage.find_objects(holes),1):
        if sl[0].start==0 or sl[1].start==0 or sl[0].stop==H or sl[1].stop==W: continue
        area=(holes[sl]==i).sum()
        if area>0.004*H*W and (best is None or area>best[0]): best=(area,sl)
    if best:
        sl=best[1]; return dict(s=s, ax=(sl[1].start+sl[1].stop)/2, ay=sl[0].start, ty=158, kind='hole')
    comp,n=ndimage.label(ndimage.binary_dilation(al,iterations=2))
    objs=ndimage.find_objects(comp)
    if n>1:
        top=min(range(n),key=lambda i:objs[i][0].start); sl=objs[top]
        if (sl[1].stop-sl[1].start)>0.5*W:
            col=(comp[:,W//2]==top+1); ys=np.nonzero(col)[0]
            return dict(s=s*0.9, ax=W/2, ay=ys.max() if len(ys) else sl[0].stop, ty=159, kind='stache')
    return dict(s=s, ax=W/2, ay=0, ty=131, kind='top')

def deco_mask(a):
    f = a.astype(float) / 255
    r, g, b, al = f[..., 0], f[..., 1], f[..., 2], f[..., 3]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    s = (mx - mn) / np.maximum(mx, 1e-6)
    m = (al > 0.3) & ((r - b) > 0.17) & (s > 0.33) & (mx > 0.42) & (g > b + 0.06)
    m = ndimage.binary_closing(m, iterations=2)
    m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= 25])
    return ndimage.binary_dilation(keep, iterations=1) & (al > 0.05)

def slice_sheet(path, cols, rows):
    a = np.array(Image.open(path).convert('RGBA'))
    al = a[..., 3] > 8
    lab, _ = ndimage.label(al)
    H, W = al.shape
    cells = {}
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab[sl] == i
        if m.sum() < 30: continue
        ys, xs = np.nonzero(m)
        c = (int((ys.mean() + sl[0].start) / (H / rows)), int((xs.mean() + sl[1].start) / (W / cols)))
        cells.setdefault(c, []).append(i)
    out = {}
    for (r, c), ids in cells.items():
        mask = np.isin(lab, ids)
        ys, xs = np.nonzero(mask)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        part = a[y0:y1, x0:x1].copy()
        part[..., 3] = np.where(mask[y0:y1, x0:x1], part[..., 3], 0)
        out[f'{r}{c}'] = part
    return out

if __name__ == '__main__':
    layout = {}
    for (name, cols, rows), path in zip(SHEETS, sys.argv[1:5]):
        for cell, a in slice_sheet(path, cols, rows).items():
            key = f'{name}_{cell}'
            if key not in IDS: continue
            hair = name[0] == 'h'
            f = hair_fit(a) if hair else beard_fit(a)
            o = OVER.get(key, {})
            if 'ay' in o: f['ay'] = o['ay'] * a.shape[0]
            if 'hw' in o: f['s'] = 78 / o['hw']
            s = f['s'] * o.get('k', 1)
            x = CX - f['ax'] * s + o.get('dx', 0)
            y = f['ty'] - f['ay'] * s + o.get('dy', 0)
            w, h = a.shape[1] * s, a.shape[0] * s
            file = f"{'frisur' if hair else 'bart'}_{IDS[key]}"
            size = (max(1, round(w * SCALE)), max(1, round(h * SCALE)))
            # graue Ebene: Helligkeit auf 0..1 gestreckt
            f32 = a.astype(float)
            lum = 0.299 * f32[..., 0] + 0.587 * f32[..., 1] + 0.114 * f32[..., 2]
            vis = a[..., 3] > 128
            lo, hi = np.percentile(lum[vis], 2), np.percentile(lum[vis], 98)
            t = np.clip((lum - lo) / max(1, hi - lo), 0, 1)
            gray = np.dstack([(t * 255).astype(np.uint8)] * 3 + [(a[..., 3] * SOFT.get(key, 1)).astype(np.uint8)])
            Image.fromarray(gray).resize(size, Image.LANCZOS).save(f'{OUT}/{file}.webp', quality=88, method=6)
            deco = False
            if key in DECO:
                m = deco_mask(a)
                if m.sum() > 20:
                    d = a.copy(); d[..., 3] = np.where(m, d[..., 3], 0)
                    Image.fromarray(d).resize(size, Image.LANCZOS).save(f'{OUT}/{file}_deko.webp', quality=88, method=6)
                    deco = True
            layout[file] = [round(x / 768 * 100, 2), round(y / 1152 * 100, 2), round(w / 768 * 100, 2), deco]

    lines = ['// Generiert von scripts/traits/process.py – Lage jeder Merkmal-Ebene im 2:3-Kasten der Heldenfigur.',
             '// [links %, oben %, Breite %, hat Schmuck-Ebene]',
             'export const TRAIT_LAYOUT: Record<string, [number, number, number, boolean]> = {']
    for k in sorted(layout): lines.append(f"  '{k}': [{', '.join(str(v).lower() for v in layout[k])}],")
    lines.append('};')
    open('src/domain/traitLayout.ts', 'w').write('\n'.join(lines) + '\n')
    print(len(layout), 'Ebenen')
