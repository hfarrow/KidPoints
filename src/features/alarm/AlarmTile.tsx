import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Tile } from '../../components/Tile';
import { formatDuration } from '../app/timer';
import { useAppTheme } from '../theme/themeContext';

type AlarmTileProps = {
  headerAccessory?: ReactNode;
  isParentUnlocked: boolean;
  onLockedPress?: () => void;
  onPause: () => void;
  onReset: () => void;
  onStart: () => void;
  remainingMs: number;
  running: boolean;
};

export function AlarmTile({
  headerAccessory,
  isParentUnlocked,
  onLockedPress,
  onPause,
  onReset,
  onStart,
  remainingMs,
  running,
}: AlarmTileProps) {
  const { tokens } = useAppTheme();

  return (
    <Tile
      collapsible={false}
      floatingTitle
      headerAccessory={headerAccessory}
      summaryVisibleWhenExpanded
      title="Alarm"
      collapsedSummary={
        <View style={styles.timerSummary}>
          <Pressable
            accessibilityLabel="Open alarm settings"
            disabled={isParentUnlocked || !onLockedPress}
            onPress={onLockedPress}
            style={styles.timerValueButton}
          >
            <Text style={[styles.timerValue, { color: tokens.textPrimary }]}>
              {formatDuration(remainingMs)}
            </Text>
          </Pressable>
          {isParentUnlocked ? (
            <View
              style={[
                styles.timerControlsRail,
                { backgroundColor: tokens.controlSurface },
              ]}
            >
              <Pressable
                onPress={() => {
                  if (running) {
                    onPause();
                    return;
                  }

                  onStart();
                }}
                style={[
                  styles.timerControlSegment,
                  styles.timerControlSegmentLeft,
                  { borderRightColor: tokens.border },
                ]}
              >
                <Text
                  style={[
                    styles.timerActionText,
                    { color: tokens.controlText },
                  ]}
                >
                  {running ? 'Pause' : 'Start'}
                </Text>
              </Pressable>
              <Pressable
                onPress={onReset}
                style={[
                  styles.timerControlSegment,
                  styles.timerControlSegmentRight,
                  { borderLeftColor: tokens.border },
                ]}
              >
                <Text
                  style={[
                    styles.timerActionText,
                    { color: tokens.controlText },
                  ]}
                >
                  Reset
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  timerSummary: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timerValue: {
    flexShrink: 0,
    fontSize: 30,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  timerValueButton: {
    flexShrink: 0,
  },
  timerControlsRail: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: 999,
  },
  timerControlSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  timerControlSegmentLeft: {
    borderRightWidth: 1,
  },
  timerControlSegmentRight: {
    borderLeftWidth: 1,
  },
  timerActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
