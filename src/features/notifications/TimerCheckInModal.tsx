import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KeyboardModalFrame } from '../../components/KeyboardModalFrame';
import { LoggedPressable } from '../../components/LoggedPressable';
import {
  ActionPill,
  ActionPillRow,
  StatusBadge,
} from '../../components/Skeleton';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';
import { useNotifications } from './NotificationsProvider';

function formatTriggeredAt(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TimerCheckInModal() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const parentPin = useLocalSettingsStore((state) => state.parentPin);
  const { isParentUnlocked } = useParentSession();
  const {
    activeExpiredTimerSession,
    dismissCheckInFlow,
    resolveExpiredTimerChild,
  } = useNotifications();
  const { tokens } = useAppTheme();

  useEffect(() => {
    if (activeExpiredTimerSession) {
      return;
    }

    dismissCheckInFlow();
    router.back();
  }, [activeExpiredTimerSession, dismissCheckInFlow, router]);

  if (!activeExpiredTimerSession) {
    return null;
  }

  return (
    <KeyboardModalFrame
      contentTestID="timer-check-in-content"
      hideUntilKeyboardPositioned={false}
      initialVerticalPosition="bottom"
      style={{ backgroundColor: tokens.modalBackdrop }}
      testID="timer-check-in-frame"
    >
      <View style={styles.card} testID="timer-check-in-card">
        <Text style={styles.eyebrow}>Timer Notification</Text>
        <Text style={styles.title}>Parent Check-In</Text>
        <Text style={styles.body}>
          Review the timer that triggered at{' '}
          {formatTriggeredAt(activeExpiredTimerSession.triggeredAt)}.
        </Text>

        {!isParentUnlocked ? (
          <View style={styles.lockedState}>
            <Text style={styles.lockedCopy}>
              Unlock Parent Mode before resolving points from this check-in.
            </Text>
            <ActionPill
              label={!parentPin ? 'Set PIN' : 'Unlock'}
              onPress={() =>
                router.push(
                  parentPin ? '/parent-unlock' : '/parent-unlock?mode=setup',
                )
              }
              tone="primary"
            />
          </View>
        ) : (
          <View style={styles.childList}>
            {activeExpiredTimerSession.childActions.map((childAction) => (
              <View key={childAction.childId} style={styles.childCard}>
                <View style={styles.childHeader}>
                  <Text style={styles.childName}>{childAction.childName}</Text>
                  <StatusBadge
                    label={childAction.status}
                    tone={
                      childAction.status === 'pending'
                        ? 'warning'
                        : childAction.status === 'awarded'
                          ? 'good'
                          : 'neutral'
                    }
                  />
                </View>
                {childAction.status === 'pending' ? (
                  <ActionPillRow>
                    <ActionPill
                      label="Award +1"
                      onPress={() =>
                        void resolveExpiredTimerChild(
                          childAction.childId,
                          'awarded',
                        )
                      }
                      tone="primary"
                    />
                    <ActionPill
                      label="Dismiss"
                      onPress={() =>
                        void resolveExpiredTimerChild(
                          childAction.childId,
                          'dismissed',
                        )
                      }
                    />
                  </ActionPillRow>
                ) : null}
              </View>
            ))}
          </View>
        )}

        <LoggedPressable
          logLabel="Close Timer Check-In"
          onPress={() => {
            dismissCheckInFlow();
            router.back();
          }}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>Close</Text>
        </LoggedPressable>
      </View>
    </KeyboardModalFrame>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    body: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    card: {
      alignSelf: 'center',
      backgroundColor: tokens.modalSurface,
      borderColor: tokens.border,
      borderRadius: 22,
      borderWidth: 1,
      gap: 12,
      maxWidth: 380,
      paddingHorizontal: 18,
      paddingVertical: 18,
      width: '92%',
    },
    childCard: {
      backgroundColor: tokens.controlSurface,
      borderRadius: 16,
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    childHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    childList: {
      gap: 10,
    },
    childName: {
      color: tokens.textPrimary,
      flex: 1,
      fontSize: 16,
      fontWeight: '800',
    },
    closeButton: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 999,
      justifyContent: 'center',
      minHeight: 40,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    closeText: {
      color: tokens.controlText,
      fontSize: 14,
      fontWeight: '800',
    },
    eyebrow: {
      color: tokens.accent,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    lockedCopy: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    lockedState: {
      gap: 10,
    },
    title: {
      color: tokens.textPrimary,
      fontSize: 24,
      fontWeight: '900',
    },
  });
