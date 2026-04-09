import { useMemo } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import {
  ActionPill,
  ActionPillRow,
  CompactSurface,
  SectionLabel,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import { useNotifications } from './NotificationsProvider';

function StatusRow({
  attention = false,
  label,
  value,
}: {
  attention?: boolean;
  label: string;
  value: string;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text
        style={[styles.statusValue, attention && styles.statusValueAttention]}
      >
        {value}
      </Text>
    </View>
  );
}

function formatOptionalTime(timestamp: number | null) {
  if (timestamp == null) {
    return 'None';
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function NotificationSettingsTile() {
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const {
    activeExpiredTimerSession,
    engineAvailable,
    liveCountdownNotificationsEnabled,
    openExactAlarmSettings,
    openFullScreenIntentSettings,
    openNotificationSettings,
    openPromotedNotificationSettings,
    refreshRuntimeStatus,
    runtimeStatus,
    setLiveCountdownNotificationsEnabled,
  } = useNotifications();
  const readiness = useMemo(() => {
    if (!engineAvailable) {
      return {
        label: 'Unavailable',
        tone: 'warning' as const,
      };
    }

    if (
      !runtimeStatus.notificationPermissionGranted ||
      !runtimeStatus.exactAlarmPermissionGranted ||
      !runtimeStatus.fullScreenIntentPermissionGranted ||
      (liveCountdownNotificationsEnabled &&
        runtimeStatus.promotedNotificationSettingsResolvable &&
        !runtimeStatus.promotedNotificationPermissionGranted)
    ) {
      return {
        label: 'Action Needed',
        tone: 'warning' as const,
      };
    }

    if (runtimeStatus.isRunning) {
      return {
        label: liveCountdownNotificationsEnabled ? 'Live' : 'Scheduled',
        tone: 'good' as const,
      };
    }

    return {
      label: 'Ready',
      tone: 'neutral' as const,
    };
  }, [engineAvailable, liveCountdownNotificationsEnabled, runtimeStatus]);

  return (
    <Tile
      accessory={<StatusBadge label={readiness.label} tone={readiness.tone} />}
      collapsible
      collapsibleLabel="Notifications"
      initiallyCollapsed
      summary={
        <CompactSurface>
          <View style={styles.summaryColumn}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <SectionLabel>Live Countdown</SectionLabel>
                <Text style={styles.helper}>
                  Keep the ongoing countdown notification visible while the
                  timer is running. Timer expiry alerts and check-ins still rely
                  on device notifications being allowed in system settings.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Enable live countdown notifications"
                onValueChange={setLiveCountdownNotificationsEnabled}
                thumbColor="#f8fafc"
                trackColor={{
                  false: tokens.controlTrackOff,
                  true: tokens.accent,
                }}
                value={liveCountdownNotificationsEnabled}
              />
            </View>
          </View>
        </CompactSurface>
      }
      title="Notifications"
    >
      <View style={styles.statusGrid}>
        <Tile
          density="extraCompact"
          muted
          style={styles.statusSurface}
          title="Readiness"
        >
          <StatusRow
            label="Native Module"
            value={engineAvailable ? 'Connected' : 'Unavailable'}
          />
          <StatusRow
            attention={!runtimeStatus.notificationPermissionGranted}
            label="Notifications"
            value={
              runtimeStatus.notificationPermissionGranted
                ? 'Allowed'
                : 'Permission Needed'
            }
          />
          <StatusRow
            attention={!runtimeStatus.exactAlarmPermissionGranted}
            label="Exact Alarms"
            value={
              runtimeStatus.exactAlarmPermissionGranted
                ? 'Allowed'
                : 'Needs Setting'
            }
          />
          <StatusRow
            attention={!runtimeStatus.fullScreenIntentPermissionGranted}
            label="Lock Screen Popup"
            value={
              runtimeStatus.fullScreenIntentPermissionGranted
                ? 'Allowed'
                : runtimeStatus.fullScreenIntentSettingsResolvable
                  ? 'Needs Setting'
                  : 'Unavailable'
            }
          />
          <StatusRow
            attention={
              liveCountdownNotificationsEnabled &&
              runtimeStatus.promotedNotificationSettingsResolvable &&
              !runtimeStatus.promotedNotificationPermissionGranted
            }
            label="Live Updates"
            value={
              liveCountdownNotificationsEnabled
                ? runtimeStatus.promotedNotificationPermissionGranted
                  ? 'Allowed'
                  : runtimeStatus.promotedNotificationSettingsResolvable
                    ? 'Needs Setting'
                    : 'Unavailable'
                : 'Off'
            }
          />
        </Tile>

        <Tile
          density="extraCompact"
          muted
          style={styles.statusSurface}
          title="Runtime"
        >
          <StatusRow
            label="Timer Surface"
            value={runtimeStatus.isRunning ? 'Running' : 'Stopped'}
          />
          <StatusRow
            label="Next Trigger"
            value={formatOptionalTime(runtimeStatus.nextTriggerAt)}
          />
          <StatusRow
            label="Last Trigger"
            value={formatOptionalTime(runtimeStatus.lastTriggeredAt)}
          />
          <StatusRow
            label="Foreground"
            value={runtimeStatus.isAppInForeground ? 'Yes' : 'No'}
          />
          <StatusRow
            label="Pending Check-In"
            value={activeExpiredTimerSession ? 'Open' : 'None'}
          />
        </Tile>
      </View>

      <ActionPillRow>
        <ActionPill
          label="Refresh"
          onPress={() => void refreshRuntimeStatus()}
        />
        <ActionPill
          label="Notifications"
          onPress={() => void openNotificationSettings()}
        />
        <ActionPill
          label="Exact Alarms"
          onPress={() => void openExactAlarmSettings()}
        />
        <ActionPill
          label="Lock Screen Popup"
          onPress={() => void openFullScreenIntentSettings()}
        />
        <ActionPill
          label="Live Updates"
          onPress={() => void openPromotedNotificationSettings()}
        />
      </ActionPillRow>
    </Tile>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    helper: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    statusGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statusLabel: {
      color: tokens.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    statusRow: {
      gap: 4,
    },
    statusSurface: {
      flexGrow: 1,
      minWidth: 160,
    },
    statusValue: {
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    statusValueAttention: {
      color: tokens.warningText,
    },
    summaryColumn: {
      gap: 12,
    },
    toggleCopy: {
      flex: 1,
      gap: 6,
    },
    toggleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
  });
