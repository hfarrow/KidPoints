import {
  assignMissingLogNamespaceColors,
  buildLogNamespaceColorAssignment,
  buildReservedNamespaceColor,
} from '../../../src/features/logs/namespaceColors';

describe('namespaceColors', () => {
  it('keeps existing namespace colors and adds missing ones in order', () => {
    const result = assignMissingLogNamespaceColors(
      {
        alpha: '#2563eb',
      },
      ['alpha', 'beta', 'gamma'],
    );

    expect(result.didChange).toBe(true);
    expect(result.colors).toEqual({
      alpha: '#2563eb',
      beta: '#dc2626',
      gamma: '#16a34a',
    });
  });

  it('reuses the base palette with brightness shifts after the first cycle', () => {
    expect(buildReservedNamespaceColor(0)).toBe('#2563eb');
    expect(buildReservedNamespaceColor(6)).toBe('#1249c1');
    expect(buildReservedNamespaceColor(12)).toBe('#5d8bf0');
  });

  it('derives contrasting text colors for dark and light badge backgrounds', () => {
    expect(buildLogNamespaceColorAssignment('#2563eb').textColor).toBe(
      '#f8fafc',
    );
    expect(buildLogNamespaceColorAssignment('#c8d9fb').textColor).toBe(
      '#0f172a',
    );
  });
});
