# Zusatz-Sets aus einem eigenen Sammelbild (je Spalte ein Set): Kopf oben, Brust mit Armteilen links/rechts,
# darunter Hose und zwei Stiefel. Schreibt Ebenen ruestung_NN_* und ergänzt armorLayout.ts (Kopf, Seitenverhältnis, Färbe-Ebenen).
# Aufruf: python3 scripts/armor/process_extra.py <bild.png> <erster Set-Index> <Spalten> [--stoff 36,…] [--ohne-baender 36,…]
#   --stoff: Sets ohne roten Stoff bekommen das Haupt-Material als Färbe-Ebene
#   --ohne-baender: herabhängende Bänder/Knoten unter der Kopfbedeckung abschneiden (sie fielen übers Gesicht)
#   --kopf-tiefer 36:40,…: Kopfbedeckung um so viele Pixel (von 1152) tiefer setzen, damit sie bis zur Stirn sitzt
# Nach scripts/armor/process.py (schreibt armorLayout.ts neu) dieses Skript erneut ausführen.
import sys, os, re, importlib.util
import numpy as np
from scipy import ndimage
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'traits'))
spec = importlib.util.spec_from_file_location('armorproc', os.path.join(os.path.dirname(__file__), 'process.py'))
P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
from process import hair_fit  # noqa: E402

LAYOUT = 'src/domain/armorLayout.ts'

def save(arr, name, width=None, height=None, fabric=False):
    im = Image.fromarray(arr)
    size = (round(width), max(1, round(im.height * width / im.width))) if width else (max(1, round(im.width * height / im.height)), round(height))
    small = im.resize(size, Image.LANCZOS)
    small.save(f'{P.OUT}/{name}.webp', quality=70, method=6)
    a = np.array(small.convert('RGBA'))
    m = P.dye_mask(a)
    if fabric and m.sum() <= 0.03 * max(1, (a[..., 3] > 60).sum()):
        m = P.fabric_mask(a, name)
    dye = m.sum() > 0.03 * max(1, (a[..., 3] > 60).sum())
    if dye:
        lum = a[..., :3].astype(float) @ np.array([0.299, 0.587, 0.114])
        lo, hi = np.percentile(lum[m], 2), np.percentile(lum[m], 98)
        t = (np.clip((lum - lo) / max(1, hi - lo), 0, 1) * 255).astype(np.uint8)
        soft = ndimage.gaussian_filter(m.astype(float), 0.7)
        alpha = (np.minimum(soft * 1.4, 1) * a[..., 3]).astype(np.uint8)
        Image.fromarray(np.dstack([t, t, t, alpha])).save(f'{P.OUT}/{name}_farbe.webp', quality=70, method=6)
    elif os.path.exists(f'{P.OUT}/{name}_farbe.webp'):
        os.remove(f'{P.OUT}/{name}_farbe.webp')
    return im.height / im.width, dye

def parts(a, cols):
    """Teile je Spalte, nach Höhe sortiert: Kopf, Brust (+ Arme links/rechts daneben), Hose, Stiefel."""
    H, W = a.shape[:2]
    lab, _ = ndimage.label(a[..., 3] > 24)
    comps = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if (lab[sl] == i).sum() < 400: continue
        comps.append(dict(i=i, y0=sl[0].start, y1=sl[0].stop, x0=sl[1].start, x1=sl[1].stop))
    def cut(c):
        p = a.copy(); p[..., 3] = np.where(lab == c['i'], p[..., 3], 0); return P.crop(p)
    sets = []
    for col in range(cols):
        big = [c for c in comps if (c['x1'] - c['x0']) > 0.12 * W and int(((c['x0'] + c['x1']) / 2) / (W / cols)) == col]
        big.sort(key=lambda c: c['y0'])
        head, chest, legs = big[0], big[1], big[2]
        arms = [c for c in comps if c not in big and abs((c['y0'] + c['y1']) / 2 - (chest['y0'] + chest['y1']) / 2) < 0.25 * H and (c['x1'] - c['x0']) < 0.12 * W
                and chest['x0'] - 0.1 * W < (c['x0'] + c['x1']) / 2 < chest['x1'] + 0.1 * W]
        arms.sort(key=lambda c: c['x0'])
        cx = (chest['x0'] + chest['x1']) / 2
        armL = min(arms, key=lambda c: abs((c['x0'] + c['x1']) / 2 - (chest['x0'] - 10)))
        armR = min(arms, key=lambda c: abs((c['x0'] + c['x1']) / 2 - (chest['x1'] + 10)))
        boots = sorted([c for c in comps if c['y0'] > legs['y1'] - 20 and legs['x0'] - 0.08 * W < (c['x0'] + c['x1']) / 2 < legs['x1'] + 0.08 * W], key=lambda c: c['x0'])
        assert armL is not armR and len(boots) == 2, (col, len(arms), len(boots), cx)
        sets.append(dict(head=cut(head), chest=cut(chest), arm_l=cut(armL), arm_r=cut(armR), hose=cut(legs), stiefel_l=cut(boots[0]), stiefel_r=cut(boots[1])))
    return sets

def cut_tails(p):
    """Kopfbedeckung: alles unterhalb der breitesten Zeile abschneiden, sobald es deutlich schmaler wird (Bänder, Knoten)."""
    al = p[..., 3] > 24
    wid = np.array([np.ptp(np.nonzero(r)[0]) if r.any() else 0 for r in al])
    top = int(np.argmax(wid))
    below = np.nonzero(wid[top:] < 0.72 * wid[top])[0]
    if len(below):
        p = p[:top + int(below[0])]
    return P.crop(p)

def chest_scale(p):
    """Umhänge/Schöße breiter als die Schultern: Faktor, damit die Schultern so breit wie bei anderen Sets sitzen."""
    al = p[..., 3] > 24
    H, W = al.shape
    top = al[:int(0.35 * H)]
    span = max((np.ptp(np.nonzero(r)[0]) for r in top if r.any()), default=W)
    k = W / max(1, span)
    return round(float(k), 3) if k > 1.04 else None

def patch_layout(first, n, headpos, aspect, dye, scale):
    s = open(LAYOUT).read()
    idx = [f'{i:02d}' for i in range(first, first + n)]
    # vorhandene Einträge dieser Sets entfernen (Skript ist wiederholbar)
    s = re.sub(r"\n  '(ruestung_(?:%s)_[a-z_]+)'(?:,|: [0-9.]+,)" % '|'.join(idx), '', s)
    head_block = re.search(r'export const ARMOR_HEAD: \[number, number, number\]\[\] = \[\n(.*?)\n\];', s, re.S)
    rows = head_block.group(1).split('\n')[:first]
    rows += [f'  [{", ".join(map(str, headpos[i]))}],' for i in range(first, first + n)]
    s = s[:head_block.start(1)] + '\n'.join(rows) + s[head_block.end(1):]
    asp = re.search(r'export const ARMOR_ASPECT: Record<string, number> = \{\n(.*?)\n\};', s, re.S)
    lines = [l for l in asp.group(1).split('\n') if l.strip()] + [f"  '{k}': {round(v, 4)}," for k, v in aspect.items()]
    s = s[:asp.start(1)] + '\n'.join(sorted(lines)) + s[asp.end(1):]
    dy = re.search(r'export const ARMOR_DYE = new Set<string>\(\[\n(.*?)\n\]\);', s, re.S)
    lines = [l for l in dy.group(1).split('\n') if l.strip()] + [f"  '{k}'," for k in dye]
    s = s[:dy.start(1)] + '\n'.join(sorted(lines)) + s[dy.end(1):]
    if 'export const ARMOR_SCALE' not in s:
        s += '\n/** Breitenfaktor einzelner Ebenen (z. B. Brust mit weitem Umhang: Schultern sitzen wie bei anderen Sets) */\nexport const ARMOR_SCALE: Record<string, number> = {\n};\n'
    sc = re.search(r'export const ARMOR_SCALE: Record<string, number> = \{\n(.*?)\};', s, re.S)
    lines = [l for l in sc.group(1).split('\n') if l.strip()] + [f"  '{k}': {v}," for k, v in scale.items()]
    body = '\n'.join(sorted(lines))
    s = s[:sc.start(1)] + (body + '\n' if body else '') + s[sc.end(1):]
    open(LAYOUT, 'w').write(s)

if __name__ == '__main__':
    path, first, cols = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    opt = lambda flag: {int(x) for a, b in zip(sys.argv, sys.argv[1:]) if a == flag for x in b.split(',')}
    fabric, tails = opt('--stoff'), opt('--ohne-baender')
    head_dy = {int(k): float(v) for a, b in zip(sys.argv, sys.argv[1:]) if a == '--kopf-tiefer' for k, v in (x.split(':') for x in b.split(','))}
    aspect, headpos, dye, scale = {}, {}, [], {}
    for k, p in enumerate(parts(P.load(path), cols)):
        i = first + k; fab = i in fabric
        def put(arr, part, **kw):
            name = f'ruestung_{i:02d}_{part}'
            aspect[name], d = save(arr, name, fabric=fab, **kw)
            if d: dye.append(name)
        if i in tails: p['head'] = cut_tails(p['head'])
        k = chest_scale(p['chest'])
        if k: scale[f'ruestung_{i:02d}_brust'] = k
        f = hair_fit(p['head']); s = f['s'] * 1.12; h, w = p['head'].shape[:2]
        put(p['head'], 'kopf', width=w * s * 1.15)
        headpos[i] = [round((384 - f['ax'] * s) / 768 * 100, 2), round((f['ty'] - f['ay'] * s - 4 + head_dy.get(i, 0)) / 1152 * 100, 2), round(w * s / 768 * 100, 2)]
        put(P.clear_collar(p['chest']), 'brust', width=240)
        put(p['hose'], 'hose', width=190)
        for side in 'lr':
            put(p[f'stiefel_{side}'], f'stiefel_{side}', width=64)
            put(p[f'arm_{side}'], f'arm_{side}', height=180)
    patch_layout(first, cols, headpos, aspect, sorted(dye), scale)
    print(len(aspect), 'Ebenen,', len(dye), 'färbbar, Breite:', scale, 'Kopf:', {k: [float(x) for x in v] for k, v in headpos.items()})
