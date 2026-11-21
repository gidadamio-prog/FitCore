// Eigener, generischer Lorbeerkranz (SVG): zwei Zweige, die sich von unten seitlich nach oben schwingen.
export function Laurel({ size = 64, color = 'rgb(var(--gold))', children, className }: { size?: number; color?: string; children?: React.ReactNode; className?: string }) {
  const r = 36;
  const leaves: React.ReactNode[] = [];
  const angles = [118, 136, 154, 172, 190, 208, 226, 244]; // Bildschirmwinkel: 90° = unten, 180° = links
  angles.forEach((deg, i) => {
    for (const side of [1, -1] as const) {
      const a = ((side === 1 ? deg : 180 - deg) * Math.PI) / 180;
      const x = 50 + r * Math.cos(a);
      const y = 52 + r * Math.sin(a);
      // Blatt entlang der Tangente, leicht nach außen gekippt
      const tangent = (side === 1 ? deg + 90 : 180 - deg - 90) + side * 28;
      const scale = 1 - i * 0.045;
      leaves.push(<ellipse key={`${side}-${i}`} cx={x} cy={y} rx={4.4 * scale} ry={9.5 * scale} transform={`rotate(${tangent} ${x} ${y})`} fill={color} opacity={0.95 - i * 0.04} />);
    }
  });
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <path d="M33 84 Q50 95 67 84" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        {leaves}
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
