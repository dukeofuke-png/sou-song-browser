import React from 'react';

/**
 * ChordDiagram — a ukulele chord box as inline SVG (WP-5).
 *
 * Provisional (working rule a, 13 Oct 2026): drawn here rather than with a library, so no
 * new dependency; svguitar (MIT) stays a possible later choice (design §4.1).
 *
 * Strings are drawn from the 4th string (left) to the 1st (right), matching fret strings such
 * as "0432". Left-handed mirrors that. Black on white (design §1: the working surface is black
 * and white). Frets above the 4th are shown with a starting-fret label instead of the nut.
 *
 * Props: frets (number[], -1 = muted), label (accessible name), leftHanded (bool), size (px width)
 */
function ChordDiagram({ frets, label, leftHanded = false, size = 96 }) {
  const strings = leftHanded ? [...frets].reverse() : frets;
  const n = strings.length;
  const fretted = frets.filter((f) => f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const minF = fretted.length ? Math.min(...fretted) : 0;
  const baseFret = maxF <= 4 ? 1 : minF;
  const rows = Math.max(4, maxF - baseFret + 1);

  const padX = 14;
  const top = 26;
  const gap = (size - padX * 2) / (n - 1);
  const rowH = 18;
  const height = top + rows * rowH + 10;
  const x = (i) => padX + i * gap;
  const y = (r) => top + r * rowH;

  return (
    <svg
      className="chord-diagram"
      width={size}
      height={height}
      viewBox={`0 0 ${size} ${height}`}
      role="img"
      aria-label={label}
      data-base-fret={baseFret}
    >
      {/* nut or starting-fret label */}
      {baseFret === 1
        ? <rect x={x(0)} y={top - 3} width={x(n - 1) - x(0)} height={4} fill="currentColor" />
        : <text x={2} y={y(0) + rowH * 0.7} fontSize="10" fill="currentColor" data-testid="base-fret">{baseFret}</text>}
      {/* fret lines */}
      {Array.from({ length: rows + 1 }, (_, r) => (
        <line key={`f${r}`} x1={x(0)} x2={x(n - 1)} y1={y(r)} y2={y(r)} stroke="currentColor" strokeWidth="1" />
      ))}
      {/* strings */}
      {strings.map((_, i) => (
        <line key={`s${i}`} x1={x(i)} x2={x(i)} y1={y(0)} y2={y(rows)} stroke="currentColor" strokeWidth="1" />
      ))}
      {/* open / muted markers and finger dots */}
      {strings.map((f, i) => {
        if (f < 0) {
          return <text key={`m${i}`} x={x(i)} y={top - 9} fontSize="11" textAnchor="middle" fill="currentColor" data-testid="muted">×</text>;
        }
        if (f === 0) {
          return <circle key={`o${i}`} cx={x(i)} cy={top - 13} r={4} fill="none" stroke="currentColor" strokeWidth="1.2" data-testid="open" />;
        }
        const r = f - baseFret; // row index (0-based) of this fret
        return <circle key={`d${i}`} cx={x(i)} cy={y(r) + rowH / 2} r={6} fill="currentColor" data-testid="dot" />;
      })}
    </svg>
  );
}

export default ChordDiagram;
