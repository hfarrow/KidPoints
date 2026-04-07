import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  ActionPillRow,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { MainScreenActions } from '../shell/MainScreenActions';
import { useShellSession } from '../shell/shellContext';
import { type useAppTheme, useThemedStyles } from '../theme/themeContext';

export function HomeScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked } = useShellSession();

  const compactGear = isParentUnlocked ? (
    <View style={[styles.iconAction, styles.iconActionNeutral]}>
      <Ionicons name="settings-outline" size={18} style={styles.icon} />
    </View>
  ) : null;

  return (
    <ScreenScaffold>
      <ScreenHeader actions={<MainScreenActions />} title="Home" />

      <Tile
        accessory={compactGear ?? <StatusBadge label="Ready" tone="good" />}
        summary={
          <View style={styles.timerSummary}>
            <View style={styles.timerValueWrap}>
              <Text style={styles.primaryMetric}>00:30</Text>
            </View>
            <View style={styles.timerControlsRail}>
              <View
                style={[
                  styles.timerControlSegment,
                  styles.timerControlSegmentLeft,
                ]}
              >
                <Text style={styles.timerControlText}>Start</Text>
              </View>
              <View
                style={[
                  styles.timerControlSegment,
                  styles.timerControlSegmentRight,
                ]}
              >
                <Text style={styles.timerControlText}>Reset</Text>
              </View>
            </View>
          </View>
        }
        title="Check-In"
      />

      <Tile muted title="Add Child">
        <View style={styles.emptyStateRow}>
          <ActionPill label="Add" tone="primary" />
          <Text style={styles.emptyStateCopy}>Add a child to get started!</Text>
        </View>
      </Tile>

      <Tile
        accessory={compactGear}
        summary={
          <View style={styles.pointsSummary}>
            <View style={styles.pointsRail}>
              <View style={[styles.pointsSegment, styles.pointsCapLeft]}>
                <Text style={[styles.pointsCapText, styles.pointsCapTextLeft]}>
                  -1
                </Text>
              </View>
              <View style={styles.pointsCore}>
                <Text style={styles.pointsValue}>128</Text>
              </View>
              <View style={[styles.pointsSegment, styles.pointsCapRight]}>
                <Text style={[styles.pointsCapText, styles.pointsCapTextRight]}>
                  +1
                </Text>
              </View>
            </View>
          </View>
        }
        title="Ava"
      />

      <Tile
        accessory={
          <StatusBadge
            label={isParentUnlocked ? 'Unlocked' : 'Locked'}
            tone={isParentUnlocked ? 'good' : 'warning'}
          />
        }
        title="Parent"
      >
        <ActionPillRow>
          <ActionPill label="Add child" />
          <ActionPill
            label="Archive"
            onPress={() => router.push('/list-browser')}
          />
          <ActionPill
            label="Edit"
            onPress={() => router.push('/edit-dialog')}
          />
        </ActionPillRow>
      </Tile>
    </ScreenScaffold>
  );
}

const createStyles = ({
  resolvedTheme,
  tokens,
}: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    emptyStateRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    emptyStateCopy: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    iconAction: {
      alignItems: 'center',
      borderRadius: 16,
      flexShrink: 0,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    iconActionNeutral: {
      backgroundColor: tokens.controlSurface,
    },
    icon: {
      color: tokens.controlText,
    },
    timerSummary: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      minWidth: 0,
    },
    timerValueWrap: {
      flexShrink: 0,
    },
    primaryMetric: {
      color: tokens.textPrimary,
      fontSize: 28,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.6,
    },
    timerControlsRail: {
      backgroundColor: tokens.controlSurface,
      borderRadius: 999,
      flex: 1,
      flexDirection: 'row',
      minHeight: 38,
      minWidth: 0,
      overflow: 'hidden',
    },
    timerControlSegment: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      minWidth: 0,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    timerControlSegmentLeft: {
      borderRightColor: tokens.border,
      borderRightWidth: 1,
    },
    timerControlSegmentRight: {
      borderLeftColor: tokens.border,
      borderLeftWidth: 1,
    },
    timerControlText: {
      color: tokens.controlText,
      fontSize: 12,
      fontWeight: '800',
    },
    pointsSummary: {
      flex: 1,
      minWidth: 0,
    },
    pointsRail: {
      backgroundColor: tokens.controlSurface,
      borderRadius: 999,
      flexDirection: 'row',
      minHeight: 42,
      overflow: 'hidden',
    },
    pointsSegment: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    pointsCapLeft: {
      backgroundColor: resolvedTheme === 'dark' ? '#4a1f1d' : '#fee2e2',
      borderRightColor: resolvedTheme === 'dark' ? '#7f1d1d' : '#fbcfe8',
      borderRightWidth: 1,
      flexBasis: 0,
      flexGrow: 2,
    },
    pointsCapRight: {
      backgroundColor: resolvedTheme === 'dark' ? '#15352b' : '#dcfce7',
      borderLeftColor: resolvedTheme === 'dark' ? '#166534' : '#bbf7d0',
      borderLeftWidth: 1,
      flexBasis: 0,
      flexGrow: 2,
    },
    pointsCore: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      flexBasis: 0,
      flexGrow: 6,
      justifyContent: 'center',
      minWidth: 0,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    pointsCapText: {
      fontSize: 14,
      fontWeight: '800',
    },
    pointsCapTextLeft: {
      color: resolvedTheme === 'dark' ? '#fee2e2' : '#7f1d1d',
    },
    pointsCapTextRight: {
      color: resolvedTheme === 'dark' ? '#dcfce7' : '#166534',
    },
    pointsValue: {
      color: tokens.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
  });
