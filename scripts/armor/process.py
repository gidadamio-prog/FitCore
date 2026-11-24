# Rüstungs-Sets: zerlegt die 5 Sammelbilder (Kopf, Brust, Hose, Stiefel, Arme – je 6 × 6 Sets, Arme als Paare),
# erkennt je Grundkörper Schultern, Rumpf, Hüfte, Arme, Knie und Füße und schreibt Ankerpunkte + Ebenen.
# Aufruf: python3 scripts/armor/process.py <kopf.png> <brust.png> <hose.png> <stiefel.png> <arme.png>
import sys, os, glob, json, math
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'traits'))
from process import hair_fit  # noqa: E402

OUT = 'src/assets/rpg'
REF = 'athletisch'

def runs(r):
    d=np.diff(np.concatenate([[0],r.astype(int),[0]]))
    return [(int(s),int(e)) for s,e in zip(np.nonzero(d==1)[0],np.nonzero(d==-1)[0]) if e-s>3]
def marks(m):
    H=m.shape[0]
    top=next(y for y in range(200,400) if np.ptp(np.nonzero(m[y])[0])>240)
    xs=np.nonzero(m[top+60])[0]; sL,sR=int(xs.min()),int(xs.max())
    rows={}
    for y in range(top+30,760,2):
        rs=runs(m[y])
        if len(rs)>=3: rows[y]=rs
    armpit=min(rows)
    legs_top=next(y for y in range(650,900) if not any(r[0]<=384<=r[1] for r in runs(m[y])))
    feet=int(np.nonzero(m.any(1))[0].max())
    # Arme von der Achsel abwärts verfolgen (Lauf mit größter Überlappung zur Vorzeile)
    track={'L':{}, 'R':{}}
    for s in 'LR':
        prev=rows[armpit][0] if s=='L' else rows[armpit][-1]
        for y in range(armpit,900,2):
            rs=[r for r in runs(m[y]) if not (r[0]<=384<=r[1])]
            best=None;bo=0
            for r in rs:
                o=min(r[1],prev[1])-max(r[0],prev[0])
                if o>bo: best,bo=r,o
            if best is None or (best[1]-best[0])>2.2*max(20,prev[1]-prev[0])+10: break
            track[s][y]=best; prev=best
    aY1=min(max(track['L']),max(track['R']))
    def mid(y):
        rs=runs(m[y]); c=[r for r in rs if r[0]<=384<=r[1]]
        return c[0] if c else None
    tw=[(y,rows[y][1]) for y in rows if y<legs_top-10 and len(rows[y])>=3 and rows[y][1][0]<384<rows[y][1][1]]
    chest=[r for y,r in tw if y<armpit+80]
    torsoL=min(r[0] for y,r in tw); torsoR=max(r[1] for y,r in tw)
    chestL=min(r[0] for r in chest); chestR=max(r[1] for r in chest)
    hip=mid(legs_top-25) or (torsoL,torsoR)
    def arm(y,side):
        t=track[side]; k=min(t,key=lambda q: abs(q-y)); return k,t[k]
    elbow_y=armpit+0.42*(aY1-armpit); wrist_y=aY1-0.17*(aY1-armpit)
    knee=legs_top+0.42*(feet-legs_top); ankle=feet-62
    def leg(y,side):
        rs=runs(m[int(y)]); return rs[0] if side=='L' else rs[-1]
    return dict(top=top,sL=sL,sR=sR,armpit=armpit,aY1=aY1,legs_top=legs_top,feet=feet,torso=(torsoL,torsoR),chest=(chestL,chestR),hip=hip,
        elbow={s:arm(elbow_y,s) for s in 'LR'},wrist={s:arm(wrist_y,s) for s in 'LR'},hand={s:arm(max(track[s])-16,s) for s in 'LR'},handEnd={s:max(track[s]) for s in 'LR'},
        knee={s:leg(knee,s) for s in 'LR'},kneeY=knee,ankle={s:leg(ankle,s) for s in 'LR'},ankleY=ankle,foot={s:leg(feet-20,s) for s in 'LR'})


def load(path):
    a = np.array(Image.open(path).convert('RGBA'))
    if (a[..., 3] == 255).all():  # weißer Hintergrund → vom Rand aus freistellen
        rgb = a[..., :3].astype(int)
        white = (rgb.min(-1) > 236) & ((rgb.max(-1) - rgb.min(-1)) < 14)
        lab, _ = ndimage.label(white)
        border = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1]); border.discard(0)
        bg = np.isin(lab, list(border))
        for i, sl in enumerate(ndimage.find_objects(lab), 1):
            if i in border or sl is None: continue
            if (lab[sl] == i).sum() >= 300: bg |= lab == i
        a[..., 3] = np.where(bg, 0, 255)
    return a

def crop(p):
    ys, xs = np.nonzero(p[..., 3] > 24)
    return p[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

def cells(a, cols):
    H, W = a.shape[:2]
    al = a[..., 3] > 24
    lab, _ = ndimage.label(al)
    out = {}
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab[sl] == i
        if m.sum() < 40: continue
        ys, xs = np.nonzero(m)
        k = (int((ys.mean() + sl[0].start) / (H / 6)), int((xs.mean() + sl[1].start) / (W / cols)))
        out.setdefault(k, []).append(i)
    res = {}
    for (r, c), ids in out.items():
        mask = np.isin(lab, ids)
        p = a.copy(); p[..., 3] = np.where(mask, p[..., 3], 0)
        res[r * cols + c] = crop(p)
    return res

def clear_collar(a):
    H, W = a.shape[:2]
    lum = a[..., :3].astype(float).mean(-1)
    box = np.zeros((H, W), bool); box[:int(0.2 * H), int(0.3 * W):int(0.7 * W)] = True
    cand = box & (lum < 70) & (a[..., 3] > 24)
    lab, n = ndimage.label(cand)
    if n:
        sizes = ndimage.sum(cand, lab, range(1, n + 1)); big = int(np.argmax(sizes)) + 1
        if sizes[big - 1] > 0.004 * H * W:
            rm = ndimage.binary_dilation(lab == big, iterations=1) & box & (lum < 95)
            a[..., 3] = np.where(rm, 0, a[..., 3])
    return a

DYE = []

def dye_mask(a):
    """Färbbarer Stoff: kräftiges Rot/Purpur (Gold, Leder, Metall und Haut bleiben)."""
    f = a.astype(float) / 255
    r, g, b, al = f[..., 0], f[..., 1], f[..., 2], f[..., 3]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    s = (mx - mn) / np.maximum(mx, 1e-6)
    red = (r > 1.55 * g + 0.02) & (r > 1.35 * b) & (s > 0.3) & (mx > 0.12)
    purple = (r > 1.3 * g) & (b > 1.3 * g) & (s > 0.25) & (mx > 0.12)
    m = (red | purple) & (al > 0.3)
    m = ndimage.binary_closing(ndimage.binary_opening(m, iterations=1), iterations=1)
    return m

def fabric_mask(a, name):
    """Fallback ohne roten Stoff: Haupt-Material (Stoff, Leder) – ohne Gold, Stahl, Schwarz und ohne Hände."""
    f = a.astype(float) / 255
    r, g, b, al = f[..., 0], f[..., 1], f[..., 2], f[..., 3]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = (mx - mn) / np.maximum(mx, 1e-6)
    gold = (h >= 33) & (h <= 60) & (s > 0.38) & (mx > 0.45)
    steel = s < 0.1
    m = (al > 0.3) & ~gold & ~steel & (mx > 0.1)
    if '_arm_' in name:
        m[int(m.shape[0] * 0.72):] = False  # Hände
    return ndimage.binary_closing(ndimage.binary_opening(m, iterations=1), iterations=1)

def save(arr, name, width=None, height=None):
    im = Image.fromarray(arr)
    if width: size = (round(width), max(1, round(im.height * width / im.width)))
    else: size = (max(1, round(im.width * height / im.height)), round(height))
    small = im.resize(size, Image.LANCZOS)
    small.save(f'{OUT}/{name}.webp', quality=70, method=6)
    # Färbe-Ebene: nur der rote/purpurne Stoff, grau (Helligkeit gestreckt) – eingefärbt in der App
    a = np.array(small.convert('RGBA'))
    m = dye_mask(a)
    if m.sum() <= 0.03 * max(1, (a[..., 3] > 60).sum()) and int(name.split('_')[1]) < 24:
        m = fabric_mask(a, name)  # nur Stoff-/Lederteile – Metallrüstung bleibt Metall
    if m.sum() > 0.03 * max(1, (a[..., 3] > 60).sum()):
        lum = a[..., :3].astype(float) @ np.array([0.299, 0.587, 0.114])
        lo, hi = np.percentile(lum[m], 2), np.percentile(lum[m], 98)
        t = (np.clip((lum - lo) / max(1, hi - lo), 0, 1) * 255).astype(np.uint8)
        soft = ndimage.gaussian_filter(m.astype(float), 0.7)
        alpha = (np.minimum(soft * 1.4, 1) * a[..., 3]).astype(np.uint8)
        Image.fromarray(np.dstack([t, t, t, alpha])).save(f'{OUT}/{name}_farbe.webp', quality=70, method=6)
        DYE.append(name)
    return im.height / im.width

def anchors(path):
    m = np.array(Image.open(path).convert('RGBA'))[..., 3] > 100
    M = marks(m); A = {}
    sw = M['sR'] - M['sL']; torsoLen = M['legs_top'] - M['top']; tw = M['torso'][1] - M['torso'][0]
    cw = max(sw * 1.14, tw * 1.22)
    A['chest'] = dict(cx=(M['sL'] + M['sR']) / 2, top=M['top'] - 34, w=cw, ky=torsoLen / cw)
    hL, hR = M['hip']; kspan = M['knee']['R'][1] - M['knee']['L'][0]
    waist = M['top'] + 0.62 * torsoLen
    lw = max(hR - hL, kspan, tw * 1.12) * 1.08
    A['legs'] = dict(l=384 - lw / 2, t=waist, w=lw, h=(M['ankleY'] + 14) - waist)
    for s in 'LR':
        fL, fR = M['foot'][s]; aL, aR = M['ankle'][s]
        A['feet' + s] = dict(cx=(fL + fR) / 2, bottom=M['feet'] + 5, w=max(fR - fL, (aR - aL) * 1.25) * 1.25)
        (ey, (e0, e1)), (hy, (h0, h1)) = M['elbow'][s], M['hand'][s]; he = M['handEnd'][s]
        sy = M['armpit'] + 0.18 * (he - M['armpit'])
        ex, hx = (e0 + e1) / 2, (h0 + h1) / 2
        sx = ex + (hx - ex) * (sy - ey) / (hy - ey) if hy != ey else ex
        dx, dy = hx - sx, (he + 6) - sy
        A['arm' + s] = dict(cx=(sx + hx) / 2 + dx * 0.02, cy=(sy + he + 6) / 2, len=math.hypot(dx, dy) * 1.04, w=max(e1 - e0, h1 - h0) * 1.55, ang=math.degrees(math.atan2(dx, dy)))
    return A

HEAD_DY = {20: -14}

if __name__ == '__main__':
    head, chest, legs, feet, arms = sys.argv[1:6]
    aspect, headpos = {}, {}
    for i, p in cells(load(head), 6).items():
        f = hair_fit(p); s = f['s'] * 1.12; h, w = p.shape[:2]
        name = f'ruestung_{i:02d}_kopf'
        aspect[name] = save(p, name, width=w * s * 1.15)
        headpos[i] = [round((384 - f['ax'] * s) / 768 * 100, 2), round((f['ty'] - f['ay'] * s - 4 + HEAD_DY.get(i, 0)) / 1152 * 100, 2), round(w * s / 768 * 100, 2)]
    for i, p in cells(load(chest), 6).items():
        name = f'ruestung_{i:02d}_brust'; aspect[name] = save(clear_collar(p), name, width=240)
    for i, p in cells(load(legs), 6).items():
        name = f'ruestung_{i:02d}_hose'; aspect[name] = save(p, name, width=190)
    for i, p in cells(load(feet), 6).items():
        H, W = p.shape[:2]; col = (p[..., 3] > 24).sum(0); lo, hi = int(W * 0.35), int(W * 0.65); cut = lo + int(np.argmin(col[lo:hi]))
        for s, part in (('l', p[:, :cut]), ('r', p[:, cut:])):
            name = f'ruestung_{i:02d}_stiefel_{s}'; aspect[name] = save(crop(part), name, width=64)
    a = load(arms); H, W = a.shape[:2]
    for r in range(6):
        for c in range(12):
            part = crop(a[round(r * H / 6):round((r + 1) * H / 6), round(c * W / 12):round((c + 1) * W / 12)])
            name = f'ruestung_{r * 6 + c // 2:02d}_arm_{"l" if c % 2 == 0 else "r"}'; aspect[name] = save(part, name, height=180)
    bodies = {os.path.basename(f)[8:-5]: anchors(f) for f in sorted(glob.glob(f'{OUT}/koerper_*.webp'))}
    ref = bodies[REF]['chest']['ky']
    X = lambda v: round(v / 768 * 100, 2)
    Y = lambda v: round(v / 1152 * 100, 2)
    L = ['// Generiert von scripts/armor/process.py – Lage der Rüstungsebenen im 2:3-Kasten (Prozent).',
         'export interface ArmLayer { cx: number; cy: number; len: number; w: number; ang: number }',
         'export interface BodyArmor {',
         '  /** Brust: Mitte x, Oberkante, Breite; ky = Längenfaktor des Rumpfs relativ zum Referenzkörper */',
         '  chest: { cx: number; top: number; w: number; ky: number };',
         '  legs: [number, number, number, number];',
         '  feetL: { cx: number; bottom: number; w: number };',
         '  feetR: { cx: number; bottom: number; w: number };',
         '  armL: ArmLayer;',
         '  armR: ArmLayer;',
         '}',
         'export const ARMOR_BODY: Record<string, BodyArmor> = {']
    for b, A in bodies.items():
        c = A['chest']; lg = A['legs']
        parts = [f"chest: {{ cx: {X(c['cx'])}, top: {Y(c['top'])}, w: {X(c['w'])}, ky: {round(c['ky'] / ref, 3)} }}",
                 f"legs: [{X(lg['l'])}, {Y(lg['t'])}, {X(lg['w'])}, {Y(lg['h'])}]"]
        for s in 'LR':
            f = A['feet' + s]; parts.append(f"feet{s}: {{ cx: {X(f['cx'])}, bottom: {Y(f['bottom'])}, w: {X(f['w'])} }}")
        for s in 'LR':
            r = A['arm' + s]; parts.append(f"arm{s}: {{ cx: {X(r['cx'])}, cy: {Y(r['cy'])}, len: {Y(r['len'])}, w: {X(r['w'])}, ang: {round(-r['ang'], 1)} }}")
        L.append(f"  '{b}': {{ " + ', '.join(parts) + ' },')
    L += ['};', '', '/** Kopfteile wie Frisuren: [links %, oben %, Breite %] je Set-Index */', 'export const ARMOR_HEAD: [number, number, number][] = [']
    L += [f'  [{", ".join(map(str, headpos[i]))}],' for i in range(36)]
    L += ['];', '', '/** Seitenverhältnis (Höhe/Breite) jeder Ebene */', 'export const ARMOR_ASPECT: Record<string, number> = {']
    L += [f"  '{k}': {round(v, 4)}," for k, v in sorted(aspect.items())]
    L += ['};', '', '/** Ebenen mit Färbe-Maske (roter/purpurner Stoff) */', 'export const ARMOR_DYE = new Set<string>([']
    L += [f"  '{k}'," for k in sorted(DYE)]
    L += [']);']
    open('src/domain/armorLayout.ts', 'w').write('\n'.join(L) + '\n')
    print(len(aspect), 'Ebenen,', len(bodies), 'Körper')
