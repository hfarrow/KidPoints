import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type useAppTheme, useThemedStyles } from '../theme/appTheme';

type CountdownTileSummaryProps = {
  remainingLabel: string;
  statusLabel: string;
  statusTone: 'good' | 'neutral' | 'warning';
  trailingAction?: ReactNode;
};

export function CountdownTileSummary({
  remainingLabel,
  statusLabel,
  statusTone,
  trailingAction,
}: CountdownTileSummaryProps) {
  const styles = useThemedStyles(createStyles);
  const accessibilityHint =
    statusTone === 'warning'
      ? 'Countdown expired'
      : statusTone === 'good'
        ? 'Countdown running'
        : 'Countdown ready';

  return (
    <View style={styles.summary}>
      <View
        accessibilityHint={accessibilityHint}
        accessibilityLabel={`Countdown ${statusLabel} ${remainingLabel}`}
        accessible
        style={styles.copy}
      >
        <Text style={styles.value}>{remainingLabel}</Text>
      </View>
      {trailingAction ? (
        <View style={styles.trailingAction}>{trailingAction}</View>
      ) : null}
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    summary: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      minWidth: 0,
    },
    copy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    value: {
      color: tokens.textPrimary,
      fontSize: 32,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.7,
    },
    trailingAction: {
      flexShrink: 0,
    },
  });
