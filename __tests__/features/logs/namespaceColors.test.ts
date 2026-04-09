import {
  assignMissingLogNamespaceColors,
  buildLogLevelColorAssignment,
  buildLogNamespaceColorAssignment,
  buildNamespaceTintedTileBackgroundColor,
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

  it('blends namespace colors into the tile surface for tinted log rows', () => {
    expect(buildNamespaceTintedTileBackgroundColor('#2563eb', '#e3d5fb')).toBe(
      '#b5baf7',
    );
  });

  it('maps log levels to console-like badge colors', () => {
    expect(buildLogLevelColorAssignment('error')).toEqual({
      backgroundColor: '#7f1d1d',
      textColor: '#fee2e2',
    });
    expect(buildLogLevelColorAssignment('warn')).toEqual({
      backgroundColor: '#854d0e',
      textColor: '#fef3c7',
    });
    expect(buildLogLevelColorAssignment('info')).toEqual({
      backgroundColor: '#d1d5db',
      textColor: '#111827',
    });
    expect(buildLogLevelColorAssignment('debug')).toEqual({
      backgroundColor: '#4b5563',
      textColor: '#f8fafc',
    });
    expect(buildLogLevelColorAssignment('temp')).toEqual({
      backgroundColor: '#1d4ed8',
      textColor: '#dbeafe',
    });
  });
});
