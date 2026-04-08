import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
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
import { createModuleLogger } from '../../logging/logger';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';

const log = createModuleLogger('alarm-screen');

export function AlarmScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked } = useParentSession();
  const { tokens } = useAppTheme();

  useEffect(() => {
    log.debug('Alarm screen initialized');
  }, []);

  return (
    <ScreenScaffold>
      <ScreenHeader
        actions={<MainScreenActions />}
        title="Alarm"
        titleIcon={
          <Feather color={tokens.textPrimary} name="clock" size={22} />
        }
      />

      {!isParentUnlocked ? (
        <Tile
          accessory={<StatusBadge label="Locked" tone="warning" />}
          title="Unlock Required"
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
              label={isParentUnlocked ? 'Parent Ready' : 'Preview Only'}
              tone={isParentUnlocked ? 'good' : 'warning'}
            />
          }
          title="Countdown Preview"
        >
          <SkeletonCluster lines={['48%', '66%', '33%']} />
          <ActionPillRow>
            <ActionPill label="Start" tone="primary" />
            <ActionPill label="Pause" />
            <ActionPill label="Reset" />
          </ActionPillRow>
        </Tile>

        <Tile title="Interval And Duration">
          <View style={styles.column}>
            <CompactSurface>
              <SectionLabel>Check-In Cadence</SectionLabel>
              <SkeletonCluster lines={['34%', '58%']} />
            </CompactSurface>
            <CompactSurface>
              <SectionLabel>Session Length</SectionLabel>
              <SkeletonCluster lines={['26%', '41%']} />
            </CompactSurface>
          </View>
        </Tile>

        <Tile
          accessory={<StatusBadge label="Skeleton" />}
          title="Notifications And Readiness"
        >
          <View style={styles.column}>
            <CompactSurface>
              <SectionLabel>Runtime State</SectionLabel>
              <SkeletonCluster lines={['52%', '66%']} />
            </CompactSurface>
            <CompactSurface>
              <SectionLabel>Corrective Actions</SectionLabel>
              <ActionPillRow>
                <ActionPill
                  label="Open Settings"
                  onPress={() => router.push('/settings')}
                />
                <ActionPill
                  label="Open List View"
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
