import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Tile } from '../../components/Tile';
import { formatTime } from '../app/timer';
import { useAppTheme } from '../theme/themeContext';

type NotificationSettingsTileProps = {
  countdownNotificationChannelImportance: number | null;
  countdownNotificationHasPromotableCharacteristics: boolean;
  countdownNotificationIsOngoing: boolean;
  countdownNotificationRequestedPromoted: boolean;
  countdownNotificationUsesChronometer: boolean;
  countdownNotificationWhen: number | null;
  engineAvailable: boolean;
  exactAlarmPermissionGranted: boolean;
  expiredIntervalsCount: number;
  expiredNotificationCategory: string | null;
  expiredNotificationChannelImportance: number | null;
  expiredNotificationHasCustomHeadsUp: boolean;
  expiredNotificationHasFullScreenIntent: boolean;
  fullScreenIntentPermissionGranted: boolean;
  fullScreenIntentSettingsResolvable: boolean;
  isAppInForeground: boolean;
  isRunning: boolean;
  lastTriggeredAt: number | null;
  nextTriggerAt: number | null;
  notificationPermissionGranted: boolean;
  notificationsEnabled: boolean;
  promotedNotificationSettingsResolvable: boolean;
  promotedNotificationPermissionGranted: boolean;
  onNotificationsEnabledChange: (value: boolean) => void;
  onOpenExactAlarmSettings: () => void;
  onOpenFullScreenIntentSettings: () => void;
  onOpenNotificationSettings: () => void;
  onOpenPromotedNotificationSettings: () => void;
  onRefreshStatus: () => void;
};

export function NotificationSettingsTile({
  countdownNotificationChannelImportance,
  countdownNotificationHasPromotableCharacteristics,
  countdownNotificationIsOngoing,
  countdownNotificationRequestedPromoted,
  countdownNotificationUsesChronometer,
  countdownNotificationWhen,
  engineAvailable,
  exactAlarmPermissionGranted,
  expiredIntervalsCount,
  expiredNotificationCategory,
  expiredNotificationChannelImportance,
  expiredNotificationHasCustomHeadsUp,
  expiredNotificationHasFullScreenIntent,
  fullScreenIntentPermissionGranted,
  fullScreenIntentSettingsResolvable,
  isAppInForeground,
  isRunning,
  lastTriggeredAt,
  nextTriggerAt,
  notificationPermissionGranted,
  notificationsEnabled,
  promotedNotificationSettingsResolvable,
  promotedNotificationPermissionGranted,
  onNotificationsEnabledChange,
  onOpenExactAlarmSettings,
  onOpenFullScreenIntentSettings,
  onOpenNotificationSettings,
  onOpenPromotedNotificationSettings,
  onRefreshStatus,
}: NotificationSettingsTileProps) {
  const { tokens } = useAppTheme();
  const [showDebugStatus, setShowDebugStatus] = useState(false);
  const liveUpdatesSupported =
    promotedNotificationPermissionGranted ||
    promotedNotificationSettingsResolvable;
  const needsAttention =
    !engineAvailable ||
    !notificationsEnabled ||
    (notificationsEnabled &&
      (!notificationPermissionGranted ||
        !exactAlarmPermissionGranted ||
        !fullScreenIntentPermissionGranted ||
        (liveUpdatesSupported && !promotedNotificationPermissionGranted)));
  const collapsedLabel = !engineAvailable
    ? 'Native module unavailable'
    : needsAttention
      ? notificationsEnabled
        ? 'Action needed'
        : 'Off'
      : notificationsEnabled
        ? 'Ready'
        : 'Off';

  return (
    <Tile
      collapsedSummary={
        <Text style={[styles.collapsedSummary, { color: tokens.textMuted }]}>
          {collapsedLabel}
        </Text>
      }
      floatingTitle
      headerAccessory={
        needsAttention ? (
          <View
            style={[
              styles.warningBadge,
              { backgroundColor: tokens.controlSurface },
            ]}
          >
            <Feather color="#b45309" name="alert-triangle" size={18} />
          </View>
        ) : null
      }
      initiallyCollapsed
      summaryVisibleWhenExpanded
      title="Notifications"
    >
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={[styles.fieldLabel, { color: tokens.textPrimary }]}>
              Notifications enabled
            </Text>
            <Text style={[styles.fieldHint, { color: tokens.textMuted }]}>
              Turning this off also stops startup permission prompts.
            </Text>
          </View>
          <Switch
            onValueChange={onNotificationsEnabledChange}
            thumbColor="#f8fafc"
            trackColor={{ false: '#94a3b8', true: '#0f766e' }}
            value={notificationsEnabled}
          />
        </View>
        <Text style={[styles.fieldHint, { color: tokens.textMuted }]}>
          Timer expiry uses your device&apos;s system alarm sound.
        </Text>
      </View>

      {showDebugStatus ? (
        <>
          <View style={styles.section}>
            <StatusRow
              label="Engine"
              tone={!engineAvailable ? 'warn' : isRunning ? 'good' : 'neutral'}
              value={
                !engineAvailable
                  ? 'Native module unavailable in this build'
                  : isRunning
                    ? 'Running in background'
                    : 'Stopped'
              }
            />
            <StatusRow
              label="Notifications"
              tone={
                !notificationsEnabled
                  ? 'warn'
                  : notificationPermissionGranted
                    ? 'good'
                    : 'warn'
              }
              value={
                !notificationsEnabled
                  ? 'Disabled in app'
                  : notificationPermissionGranted
                    ? 'Allowed'
                    : 'Permission required'
              }
            />
            <StatusRow
              label="Exact alarms"
              tone={
                !notificationsEnabled
                  ? 'warn'
                  : exactAlarmPermissionGranted
                    ? 'good'
                    : 'warn'
              }
              value={
                !notificationsEnabled
                  ? 'Not prompting while disabled'
                  : exactAlarmPermissionGranted
                    ? 'Allowed'
                    : 'Needs system setting'
              }
            />
            <StatusRow
              label="Alarm popup"
              tone={
                !notificationsEnabled
                  ? 'warn'
                  : fullScreenIntentPermissionGranted
                    ? 'good'
                    : fullScreenIntentSettingsResolvable
                      ? 'warn'
                      : 'neutral'
              }
              value={
                !notificationsEnabled
                  ? 'Not prompting while disabled'
                  : fullScreenIntentPermissionGranted
                    ? 'Allowed'
                    : fullScreenIntentSettingsResolvable
                      ? 'Needs system setting'
                      : 'Unavailable on this system build'
              }
            />
            <StatusRow
              label="Live updates"
              tone={
                !notificationsEnabled
                  ? 'warn'
                  : promotedNotificationPermissionGranted
                    ? 'good'
                    : liveUpdatesSupported
                      ? 'warn'
                      : 'neutral'
              }
              value={
                !notificationsEnabled
                  ? 'Not prompting while disabled'
                  : promotedNotificationPermissionGranted
                    ? 'Allowed'
                    : liveUpdatesSupported
                      ? 'Needs system setting'
                      : 'Unavailable on this system build'
              }
            />
            <StatusRow
              label="Live settings page"
              tone={promotedNotificationSettingsResolvable ? 'good' : 'neutral'}
              value={
                promotedNotificationSettingsResolvable
                  ? 'Resolvable'
                  : 'Fallback only'
              }
            />
            <StatusRow
              label="Next trigger"
              tone="neutral"
              value={formatTime(nextTriggerAt)}
            />
            <StatusRow
              label="Last trigger"
              tone="neutral"
              value={formatTime(lastTriggeredAt)}
            />
            <StatusRow
              label="Pending notifications"
              tone={expiredIntervalsCount > 0 ? 'warn' : 'neutral'}
              value={String(expiredIntervalsCount)}
            />
            <StatusRow
              label="App foreground"
              tone={isAppInForeground ? 'warn' : 'neutral'}
              value={isAppInForeground ? 'Yes' : 'No'}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.debugHeading, { color: tokens.textMuted }]}>
              Live update debug
            </Text>
            <StatusRow
              label="Requested promoted"
              tone={countdownNotificationRequestedPromoted ? 'good' : 'warn'}
              value={countdownNotificationRequestedPromoted ? 'Yes' : 'No'}
            />
            <StatusRow
              label="Promotable"
              tone={
                countdownNotificationHasPromotableCharacteristics
                  ? 'good'
                  : 'warn'
              }
              value={
                countdownNotificationHasPromotableCharacteristics ? 'Yes' : 'No'
              }
            />
            <StatusRow
              label="Ongoing flag"
              tone={countdownNotificationIsOngoing ? 'good' : 'warn'}
              value={countdownNotificationIsOngoing ? 'Yes' : 'No'}
            />
            <StatusRow
              label="Chronometer"
              tone={countdownNotificationUsesChronometer ? 'good' : 'warn'}
              value={countdownNotificationUsesChronometer ? 'Yes' : 'No'}
            />
            <StatusRow
              label="Channel importance"
              tone={
                countdownNotificationChannelImportance === null
                  ? 'warn'
                  : countdownNotificationChannelImportance <= 1
                    ? 'warn'
                    : 'good'
              }
              value={formatChannelImportance(
                countdownNotificationChannelImportance,
              )}
            />
            <StatusRow
              label="Notification when"
              tone="neutral"
              value={formatTime(countdownNotificationWhen)}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.debugHeading, { color: tokens.textMuted }]}>
              Alarm alert debug
            </Text>
            <StatusRow
              label="Expired channel"
              tone={
                expiredNotificationChannelImportance === null
                  ? 'warn'
                  : expiredNotificationChannelImportance <= 2
                    ? 'warn'
                    : 'good'
              }
              value={formatChannelImportance(
                expiredNotificationChannelImportance,
              )}
            />
            <StatusRow
              label="Category"
              tone={expiredNotificationCategory === 'alarm' ? 'good' : 'warn'}
              value={expiredNotificationCategory ?? 'Unavailable'}
            />
            <StatusRow
              label="Full-screen intent"
              tone={expiredNotificationHasFullScreenIntent ? 'good' : 'warn'}
              value={expiredNotificationHasFullScreenIntent ? 'Yes' : 'No'}
            />
            <StatusRow
              label="Custom heads-up"
              tone={expiredNotificationHasCustomHeadsUp ? 'good' : 'warn'}
              value={expiredNotificationHasCustomHeadsUp ? 'Yes' : 'No'}
            />
          </View>

          <View style={styles.actionRow}>
            <Pressable
              disabled={!engineAvailable}
              onPress={onRefreshStatus}
              style={[
                styles.actionButton,
                { backgroundColor: tokens.controlSurface },
                !engineAvailable && styles.actionButtonDisabled,
              ]}
            >
              <Text style={[styles.actionText, { color: tokens.controlText }]}>
                Refresh
              </Text>
            </Pressable>
            <Pressable
              disabled={!engineAvailable || !notificationsEnabled}
              onPress={onOpenNotificationSettings}
              style={[
                styles.actionButton,
                { backgroundColor: tokens.controlSurface },
                (!engineAvailable || !notificationsEnabled) &&
                  styles.actionButtonDisabled,
              ]}
            >
              <Text style={[styles.actionText, { color: tokens.controlText }]}>
                Notifications
              </Text>
            </Pressable>
            <Pressable
              disabled={!engineAvailable || !notificationsEnabled}
              onPress={onOpenExactAlarmSettings}
              style={[
                styles.actionButton,
                { backgroundColor: tokens.controlSurface },
                (!engineAvailable || !notificationsEnabled) &&
                  styles.actionButtonDisabled,
              ]}
            >
              <Text style={[styles.actionText, { color: tokens.controlText }]}>
                Exact alarms
              </Text>
            </Pressable>
            <Pressable
              disabled={
                !engineAvailable ||
                !notificationsEnabled ||
                !fullScreenIntentSettingsResolvable
              }
              onPress={onOpenFullScreenIntentSettings}
              style={[
                styles.actionButton,
                { backgroundColor: tokens.controlSurface },
                (!engineAvailable ||
                  !notificationsEnabled ||
                  !fullScreenIntentSettingsResolvable) &&
                  styles.actionButtonDisabled,
              ]}
            >
              <Text style={[styles.actionText, { color: tokens.controlText }]}>
                Alarm popup
              </Text>
            </Pressable>
            <Pressable
              disabled={
                !engineAvailable ||
                !notificationsEnabled ||
                !promotedNotificationSettingsResolvable
              }
              onPress={onOpenPromotedNotificationSettings}
              style={[
                styles.actionButton,
                { backgroundColor: tokens.controlSurface },
                (!engineAvailable ||
                  !notificationsEnabled ||
                  !promotedNotificationSettingsResolvable) &&
                  styles.actionButtonDisabled,
              ]}
            >
              <Text style={[styles.actionText, { color: tokens.controlText }]}>
                Live updates
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowDebugStatus(true)}
          style={[
            styles.debugStatusButton,
            { backgroundColor: tokens.controlSurface },
          ]}
        >
          <Text style={[styles.actionText, { color: tokens.controlText }]}>
            show debug status
          </Text>
        </Pressable>
      )}
    </Tile>
  );
}

function formatChannelImportance(importance: number | null) {
  switch (importance) {
    case null:
      return 'Unavailable';
    case 0:
      return 'Unspecified (0)';
    case 1:
      return 'Min (1)';
    case 2:
      return 'Low (2)';
    case 3:
      return 'Default (3)';
    case 4:
      return 'High (4)';
    case 5:
      return 'Max (5)';
    default:
      return String(importance);
  }
}

function StatusRow({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'good' | 'neutral' | 'warn';
  value: string;
}) {
  const { tokens } = useAppTheme();
  const valueColor =
    tone === 'good'
      ? '#0f766e'
      : tone === 'warn'
        ? '#b45309'
        : tokens.textPrimary;

  return (
    <View style={styles.statusRow}>
      <Text style={[styles.statusLabel, { color: tokens.textMuted }]}>
        {label}
      </Text>
      <Text style={[styles.statusValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedSummary: {
    fontSize: 13,
    fontWeight: '700',
  },
  warningBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: 12,
  },
  debugHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  fieldHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  switchCopy: {
    flex: 1,
    gap: 6,
  },
  statusRow: {
    gap: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  debugStatusButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
