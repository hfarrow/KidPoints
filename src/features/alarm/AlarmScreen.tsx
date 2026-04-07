import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { MainScreenActions } from '../../components/MainScreenActions';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  ActionPillRow,
  CompactSurface,
  SectionLabel,
  SkeletonCluster,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { useParentSession } from '../parent/parentSessionContext';
import { type useAppTheme, useThemedStyles } from '../theme/themeContext';

export function AlarmScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked } = useParentSession();

  return (
    <ScreenScaffold>
      <ScreenHeader actions={<MainScreenActions />} title="Alarm" />

      {!isParentUnlocked ? (
        <Tile
          accessory={<StatusBadge label="Locked" tone="warning" />}
          title="Unlock required"
        >
          <Text style={styles.body}>
            Alarm controls are gated behind Parent Mode. This preview is live
            now, while timer behavior and runtime integration land next.
          </Text>
          <ActionPillRow>
            <ActionPill
              label="Unlock with PIN"
              onPress={() => router.push('/parent-unlock')}
              tone="primary"
            />
          </ActionPillRow>
        </Tile>
      ) : null}

      <View
        style={[styles.lockableArea, !isParentUnlocked && styles.lockedArea]}
      >
        <Tile
          accessory={
            <StatusBadge
              label={isParentUnlocked ? 'Parent ready' : 'Preview only'}
              tone={isParentUnlocked ? 'good' : 'warning'}
            />
          }
          title="Countdown preview"
        >
          <SkeletonCluster lines={['48%', '66%', '33%']} />
          <ActionPillRow>
            <ActionPill label="Start" tone="primary" />
            <ActionPill label="Pause" />
            <ActionPill label="Reset" />
          </ActionPillRow>
        </Tile>

        <Tile title="Interval and duration">
          <View style={styles.column}>
            <CompactSurface>
              <SectionLabel>Check-in cadence</SectionLabel>
              <SkeletonCluster lines={['34%', '58%']} />
            </CompactSurface>
            <CompactSurface>
              <SectionLabel>Session length</SectionLabel>
              <SkeletonCluster lines={['26%', '41%']} />
            </CompactSurface>
          </View>
        </Tile>

        <Tile
          accessory={<StatusBadge label="Skeleton" />}
          title="Notifications and readiness"
        >
          <View style={styles.column}>
            <CompactSurface>
              <SectionLabel>Runtime state</SectionLabel>
              <SkeletonCluster lines={['52%', '66%']} />
            </CompactSurface>
            <CompactSurface>
              <SectionLabel>Corrective actions</SectionLabel>
              <ActionPillRow>
                <ActionPill
                  label="Open settings"
                  onPress={() => router.push('/settings')}
                />
                <ActionPill
                  label="Open list view"
                  onPress={() => router.push('/list-browser')}
                />
              </ActionPillRow>
            </CompactSurface>
          </View>
        </Tile>
      </View>
    </ScreenScaffold>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    body: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    column: {
      gap: 10,
    },
    lockableArea: {
      gap: 12,
    },
    lockedArea: {
      opacity: 0.62,
    },
  });
