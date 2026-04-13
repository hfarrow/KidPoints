import { StyleSheet, Text, View } from 'react-native';

import { ActionPill } from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { type useAppTheme, useThemedStyles } from '../theme/appTheme';
import { TimerControlRail } from './TimerControlRail';

type CompactCountdownTileProps = {
  contextLabel: string;
  isParentUnlocked: boolean;
  onPause: () => void;
  onReset: () => void;
  onStart: () => void;
  onUnlock: () => void;
  pauseDisabled: boolean;
  remainingLabel: string;
  resetDisabled: boolean;
  startDisabled: boolean;
  statusLabel: string;
  statusTone: 'good' | 'neutral' | 'warning';
};

export function CompactCountdownTile({
  contextLabel,
  isParentUnlocked,
  onPause,
  onReset,
  onStart,
  onUnlock,
  pauseDisabled,
  remainingLabel,
  resetDisabled,
  startDisabled,
  statusLabel,
  statusTone,
}: CompactCountdownTileProps) {
  const styles = useThemedStyles(createStyles);
  const accessibilityHint =
    statusTone === 'warning'
      ? 'Countdown expired'
      : statusTone === 'good'
        ? 'Countdown running'
        : 'Countdown ready';

  return (
    <Tile
      density="extraCompact"
      headerHidden
      summary={
        <View style={styles.countdownRail}>
          <View
            accessibilityHint={accessibilityHint}
            accessibilityLabel={`Countdown ${statusLabel} ${remainingLabel}`}
            accessible
            style={styles.countdownValueWrap}
          >
            <Text style={styles.countdownValue}>{remainingLabel}</Text>
          </View>
          {isParentUnlocked ? (
            <View style={styles.countdownControlsWrap}>
              <TimerControlRail
                contextLabel={contextLabel}
                onPause={onPause}
                onReset={onReset}
                onStart={onStart}
                pauseDisabled={pauseDisabled}
                resetDisabled={resetDisabled}
                startDisabled={startDisabled}
              />
            </View>
          ) : (
            <ActionPill
              label="Unlock To Control"
              onPress={onUnlock}
              tone="primary"
            />
          )}
        </View>
      }
      title="Countdown"
    />
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    countdownControlsWrap: {
      flex: 1,
      minWidth: 0,
    },
    countdownRail: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      minWidth: 0,
    },
    countdownValue: {
      color: tokens.textPrimary,
      fontSize: 30,
      fontVariant: ['tabular-nums'],
      fontWeight: '900',
      letterSpacing: -0.7,
    },
    countdownValueWrap: {
      flexShrink: 0,
      minWidth: 0,
    },
  });
