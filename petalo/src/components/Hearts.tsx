import { memo } from 'react';

/** Small pastel-blue hearts, placed deterministically so they never jump around. */
const SPOTS = [
  { x: 6, y: 9, s: 14, r: -14 }, { x: 93, y: 6, s: 18, r: 12 }, { x: 78, y: 22, s: 10, r: -6 },
  { x: 97, y: 41, s: 12, r: 18 }, { x: 3, y: 47, s: 11, r: 8 }, { x: 88, y: 64, s: 16, r: -10 },
  { x: 12, y: 78, s: 15, r: 14 }, { x: 52, y: 95, s: 11, r: -4 }, { x: 95, y: 88, s: 13, r: 6 },
  { x: 33, y: 3, s: 9, r: 20 }, { x: 64, y: 3, s: 12, r: -16 }, { x: 44, y: 60, s: 8, r: 10 },
  { x: 72, y: 82, s: 9, r: -20 }, { x: 24, y: 96, s: 10, r: 4 },
];

function Heart({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.2 0 3.7 1.2 4.6 2.7.2.3.6.3.8 0 .9-1.5 2.4-2.7 4.6-2.7 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

export const HeartsBackdrop = memo(function HeartsBackdrop() {
  return (
    <div className="hearts-bg" aria-hidden="true">
      {SPOTS.map((p, i) => (
        <div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: `rotate(${p.r}deg)`, color: 'var(--blue)', opacity: 0.32 }}>
          <Heart size={p.s} />
        </div>
      ))}
    </div>
  );
});

export function TinyHeart({ size = 12, color = 'var(--blue)' }: { size?: number; color?: string }) {
  return (
    <span style={{ color, display: 'inline-flex' }}>
      <Heart size={size} />
    </span>
  );
}
