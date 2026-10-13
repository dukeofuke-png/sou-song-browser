import { render, screen } from '@testing-library/react';
import ChordDiagram from './ChordDiagram';

describe('ChordDiagram', () => {
  test('open shape: nut, open and muted markers, one dot per fretted string', () => {
    const { container } = render(<ChordDiagram frets={[0, 4, 3, 2]} label="Em 0432" />);
    expect(screen.getByRole('img', { name: 'Em 0432' })).toBeInTheDocument();
    expect(screen.getAllByTestId('open')).toHaveLength(1);
    expect(screen.getAllByTestId('dot')).toHaveLength(3);
    expect(screen.queryByTestId('base-fret')).toBeNull(); // nut drawn instead
    expect(container.querySelector('svg').getAttribute('data-base-fret')).toBe('1');
  });

  test('muted string shows ×', () => {
    render(<ChordDiagram frets={[-1, 1, 1, 1]} label="x111" />);
    expect(screen.getAllByTestId('muted')).toHaveLength(1);
    expect(screen.getAllByTestId('dot')).toHaveLength(3);
  });

  test('a shape above the 4th fret shows its starting fret instead of the nut', () => {
    render(<ChordDiagram frets={[-1, 10, 9, 8]} label="x,10,9,8" />);
    expect(screen.getByTestId('base-fret')).toHaveTextContent('8');
  });

  test('left-handed mirrors the strings', () => {
    const right = render(<ChordDiagram frets={[0, 0, 0, 3]} label="right" />);
    const rightDotX = right.container.querySelector('[data-testid="dot"]').getAttribute('cx');
    const left = render(<ChordDiagram frets={[0, 0, 0, 3]} label="left" leftHanded />);
    const leftDotX = left.container.querySelector('[data-testid="dot"]').getAttribute('cx');
    expect(Number(leftDotX)).toBeLessThan(Number(rightDotX));
  });
});
