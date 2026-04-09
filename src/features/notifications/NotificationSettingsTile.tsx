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

function StatusRow({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
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
  const { resolvedTheme, tokens } = useAppTheme();
  const {
    activeExpiredTimerSession,
    engineAvailable,
    notificationsEnabled,
    openExactAlarmSettings,
    openFullScreenIntentSettings,
    openNotificationSettings,
    openPromotedNotificationSettings,
    refreshRuntimeStatus,
    runtimeStatus,
    setNotificationsEnabled,
  } = useNotifications();
  const readiness = useMemo(() => {
    if (!engineAvailable) {
      return {
        label: 'Unavailable',
        tone: 'warning' as const,
      };
    }

    if (!notificationsEnabled) {
      return {
        label: 'Off',
        tone: 'warning' as const,
      };
    }

    if (
      !runtimeStatus.notificationPermissionGranted ||
      !runtimeStatus.exactAlarmPermissionGranted ||
      !runtimeStatus.fullScreenIntentPermissionGranted
    ) {
      return {
        label: 'Action Needed',
        tone: 'warning' as const,
      };
    }

    return {
      label: runtimeStatus.isRunning ? 'Live' : 'Ready',
      tone: runtimeStatus.isRunning ? ('good' as const) : ('neutral' as const),
    };
  }, [engineAvailable, notificationsEnabled, runtimeStatus]);

  return (
    <Tile
      accessory={<StatusBadge label={readiness.label} tone={readiness.tone} />}
      collapsible
      collapsibleLabel="Notifications"
      initiallyCollapsed
      summary={
        <CompactSurface>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <SectionLabel>Device Notifications</SectionLabel>
              <Text style={styles.helper}>
                Keep the native countdown live update and timer expiry alerts in
                sync with this device.
              </Text>
            </View>
            <Switch
              onValueChange={setNotificationsEnabled}
              thumbColor="#f8fafc"
              trackColor={{
                false: resolvedTheme === 'dark' ? '#475569' : '#94a3b8',
                true: tokens.accent,
              }}
              value={notificationsEnabled}
            />
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
            label="Notifications"
            value={
              notificationsEnabled
                ? runtimeStatus.notificationPermissionGranted
                  ? 'Allowed'
                  : 'Permission Needed'
                : 'Disabled'
            }
          />
          <StatusRow
            label="Exact Alarms"
            value={
              notificationsEnabled
                ? runtimeStatus.exactAlarmPermissionGranted
                  ? 'Allowed'
                  : 'Needs Setting'
                : 'Disabled'
            }
          />
          <StatusRow
            label="Alarm Popup"
            value={
              notificationsEnabled
                ? runtimeStatus.fullScreenIntentPermissionGranted
                  ? 'Allowed'
                  : runtimeStatus.fullScreenIntentSettingsResolvable
                    ? 'Needs Setting'
                    : 'Unavailable'
                : 'Disabled'
            }
          />
          <StatusRow
            label="Live Updates"
            value={
              notificationsEnabled
                ? runtimeStatus.promotedNotificationPermissionGranted
                  ? 'Allowed'
                  : runtimeStatus.promotedNotificationSettingsResolvable
                    ? 'Needs Setting'
                    : 'Unavailable'
                : 'Disabled'
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
          label="Alarm Popup"
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
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    statusRow: {
      gap: 4,
    },
    statusSurface: {
      flexGrow: 1,
      minWidth: 160,
    },
    statusValue: {
      color: tokens.textPrimary,
      fontSize: 14,
      fontWeight: '700',
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
