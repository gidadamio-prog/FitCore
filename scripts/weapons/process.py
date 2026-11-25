# Waffen: zerlegt die 13 Waffen-Blätter in Einzelbilder (transparent, zugeschnitten).
# Aufruf: python3 scripts/weapons/process.py <ordner mit blättern> (Dateinamen siehe SHEETS)
# Weißer oder Schachbrett-Hintergrund wird vom Rand aus entfernt (neutral helle Flächen).
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage

OUT = 'src/assets/rpg'
# Art: (Datei, Zeilen, Spalten, Paare)
SHEETS = {
    'bosswaffe': ('boss.png', 2, 5, False),
    'faust': ('faust.png', 2, 10, True),
    'dolch': ('dolch.png', 2, 5, False),
    'axt': ('axt.png', 1, 5, False),
    'kolben': ('kolben.png', 1, 5, False),
    'buch': ('buch.png', 2, 5, False),
    'bogen': ('bogen.png', 1, 5, False),
    'streitaxt': ('streitaxt.png', 1, 5, False),
    'stangenwaffe': ('stangenwaffe.png', 2, 5, False),
    'kriegshammer': ('kriegshammer.png', 1, 5, False),
    'saebel': ('saebel.png', 1, 5, False),
    'schwert': ('schwert.png', 2, 5, False),
    'schild': ('schild.png', 2, 5, False),
}

def load(path):
    a = np.array(Image.open(path).convert('RGBA'))
    if (a[..., 3] > 250).mean() > 0.98:
        rgb = a[..., :3].astype(int)
        bgc = (rgb.min(-1) > 195) & ((rgb.max(-1) - rgb.min(-1)) < 12)
        lab, _ = ndimage.label(bgc)
        border = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1]); border.discard(0)
        bg = np.isin(lab, list(border))
        # eingeschlossene Hintergrundinseln (z. B. im Ring des Chakrams)
        for i, sl in enumerate(ndimage.find_objects(lab), 1):
            if i in border or sl is None: continue
            if (lab[sl] == i).sum() >= 400: bg |= lab == i
        bg = ndimage.binary_dilation(bg, iterations=1) & bgc | bg
        a[..., 3] = np.where(bg, 0, 255)
        # weicher Rand
        al = ndimage.gaussian_filter(a[..., 3].astype(float), 0.6)
        a[..., 3] = np.clip(al, 0, 255).astype(np.uint8)
    return a

def crop(p):
    ys, xs = np.nonzero(p[..., 3] > 24)
    return p[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

def split_wide(lab, n, H, W, rows, cols):
    """Berührende Nachbarn (z. B. zwei Schilde) an der dünnsten Spalte trennen."""
    cw = W / cols
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None: continue
        x0, x1 = sl[1].start, sl[1].stop
        if x1 - x0 < 1.35 * cw: continue
        m = lab[sl] == i
        colsum = m.sum(0)
        lo, hi = int(0.25 * len(colsum)), int(0.75 * len(colsum))
        cut = lo + int(np.argmin(colsum[lo:hi]))
        n += 1
        sub = lab[sl]
        right = np.zeros_like(m); right[:, cut:] = True
        sub[m & right] = n
    return lab, n

def cells(a, rows, cols):
    H, W = a.shape[:2]
    lab, n = ndimage.label(a[..., 3] > 40)
    lab, n = split_wide(lab, n, H, W, rows, cols)
    groups = {}
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab[sl] == i
        if m.sum() < 30: continue
        ys, xs = np.nonzero(m)
        cy, cx = ys.mean() + sl[0].start, xs.mean() + sl[1].start
        groups.setdefault((min(rows - 1, int(cy / (H / rows))), min(cols - 1, int(cx / (W / cols)))), []).append(i)
    out = []
    for r in range(rows):
        for c in range(cols):
            ids = groups.get((r, c), [])
            if not ids:
                raise SystemExit(f'leere Zelle {r},{c} in {cur}')
            m = np.isin(lab, ids)
            ys, xs = np.nonzero(m)
            y0, y1, x0, x1 = max(0, ys.min() - 4), ys.max() + 5, max(0, xs.min() - 4), xs.max() + 5
            sub = a[y0:y1, x0:x1].copy()
            keep = ndimage.binary_dilation(m[y0:y1, x0:x1], iterations=3)
            # Teile anderer Zellen nicht mitnehmen
            keep &= ~((lab[y0:y1, x0:x1] > 0) & ~m[y0:y1, x0:x1])
            sub[..., 3] = np.where(keep, sub[..., 3], 0)
            out.append(crop(sub))
    return out

def save(arr, name, h=320):
    im = Image.fromarray(arr)
    s = h / max(im.width, im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    im.save(f'{OUT}/{name}.webp', quality=78, method=6)
    return im.width, im.height

if __name__ == '__main__':
    src = sys.argv[1]
    sizes = {}
    for kind, (f, rows, cols, pairs) in SHEETS.items():
        cur = kind; globals()['cur'] = kind
        parts = cells(load(os.path.join(src, f)), rows, cols)
        if pairs:
            for k in range(len(parts) // 2):
                for side, p in zip('LR', parts[2 * k:2 * k + 2]):
                    sizes[f'waffe_{kind}_{k:02d}_{side}'] = save(p, f'waffe_{kind}_{k:02d}_{side}', 220)
        else:
            for k, p in enumerate(parts):
                sizes[f'waffe_{kind}_{k:02d}'] = save(p, f'waffe_{kind}_{k:02d}')
    json.dump(sizes, open('/tmp/weapon_sizes.json', 'w'), indent=0)
    print(len(sizes), 'Bilder')
