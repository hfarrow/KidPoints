import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardModalFrame } from '../../components/KeyboardModalFrame';
import { LoggedPressable } from '../../components/LoggedPressable';
import { ActionPill } from '../../components/Skeleton';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import { triggerLightImpactHaptic } from '../haptics/appHaptics';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import { useNotifications } from './NotificationsProvider';

function formatTriggeredAt(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ResolveChildButton({
  accessibilityLabel,
  color,
  iconName,
  isActive,
  isDisabled,
  side,
  onPress,
}: {
  accessibilityLabel: string;
  color: string;
  iconName: 'thumbs-down' | 'thumbs-up';
  isActive: boolean;
  isDisabled: boolean;
  side: 'left' | 'right';
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <LoggedPressable
      accessibilityLabel={accessibilityLabel}
      disabled={isDisabled}
      logContext={{ accessibilityLabel, isActive }}
      logLabel={accessibilityLabel}
      onPress={onPress}
      style={[
        styles.resolveButton,
        side === 'left' ? styles.resolveButtonLeft : styles.resolveButtonRight,
        isActive ? styles.resolveButtonActive : styles.resolveButtonIdle,
        isDisabled && styles.resolveButtonDisabled,
      ]}
    >
      <Feather color={color} name={iconName} size={18} />
    </LoggedPressable>
  );
}

export function TimerCheckInModal() {
  return <TimerCheckInModalContent backdropVariant="modal" />;
}

export function TimerCheckInLockScreenModal() {
  return <TimerCheckInModalContent backdropVariant="screen" />;
}

function TimerCheckInModalContent({
  backdropVariant,
}: {
  backdropVariant: 'modal' | 'screen';
}) {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { width: windowWidth } = useWindowDimensions();
  const parentPin = useLocalSettingsStore((state) => state.parentPin);
  const hapticsEnabled = useLocalSettingsStore((state) => state.hapticsEnabled);
  const restartCountdownAfterCheckIn = useLocalSettingsStore(
    (state) => state.restartCountdownAfterCheckIn,
  );
  const setRestartCountdownAfterCheckIn = useLocalSettingsStore(
    (state) => state.setRestartCountdownAfterCheckIn,
  );
  const { isParentUnlocked } = useParentSession();
  const { activeExpiredTimerSession, resolveExpiredTimerChild } =
    useNotifications();
  const { getScreenSurface, tokens } = useAppTheme();

  const closeModal = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }, [router]);

  useEffect(() => {
    if (activeExpiredTimerSession) {
      return;
    }

    closeModal();
  }, [activeExpiredTimerSession, closeModal]);

  if (!activeExpiredTimerSession) {
    return null;
  }

  const cardWidth = Math.min(Math.max(windowWidth - 36, 280), 456);
  const frameBackgroundColor =
    backdropVariant === 'screen'
      ? getScreenSurface(false)
      : tokens.modalBackdrop;

  return (
    <KeyboardModalFrame
      contentTestID="timer-check-in-content"
      hideUntilKeyboardPositioned={false}
      initialVerticalPosition="center"
      style={{ backgroundColor: frameBackgroundColor }}
      testID="timer-check-in-frame"
    >
      <View
        style={[styles.card, { width: cardWidth }]}
        testID="timer-check-in-card"
      >
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>Timer Notification</Text>
          <Text style={styles.triggeredAt}>
            {formatTriggeredAt(activeExpiredTimerSession.triggeredAt)}
          </Text>
        </View>
        <Text style={styles.title}>Parent Check-In</Text>

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
          <>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleLabel}>Restart Countdown</Text>
                <Text style={styles.toggleHelper}>
                  Start the next cadence automatically after every child has
                  been checked in.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Restart countdown automatically"
                onValueChange={setRestartCountdownAfterCheckIn}
                thumbColor="#f8fafc"
                trackColor={{
                  false: tokens.controlTrackOff,
                  true: tokens.accent,
                }}
                value={restartCountdownAfterCheckIn}
              />
            </View>

            <View style={styles.childList}>
              {activeExpiredTimerSession.childActions.map((childAction) => (
                <View key={childAction.childId} style={styles.childRail}>
                  <ResolveChildButton
                    accessibilityLabel={`Dismiss point for ${childAction.childName}`}
                    color={tokens.resolveDismissText}
                    iconName="thumbs-down"
                    isActive={childAction.status === 'dismissed'}
                    isDisabled={childAction.status === 'dismissed'}
                    side="left"
                    onPress={() => {
                      triggerLightImpactHaptic(hapticsEnabled);
                      void resolveExpiredTimerChild(
                        childAction.childId,
                        'dismissed',
                        {
                          restartTimerOnResolve: restartCountdownAfterCheckIn,
                        },
                      );
                    }}
                  />
                  <View style={styles.childRailCore}>
                    <Text style={styles.childName}>
                      {childAction.childName}
                    </Text>
                    <Text style={styles.childStatus}>
                      {childAction.status === 'pending'
                        ? 'Pending'
                        : childAction.status === 'awarded'
                          ? 'Awarded +1'
                          : 'Dismissed'}
                    </Text>
                  </View>
                  <ResolveChildButton
                    accessibilityLabel={`Award point to ${childAction.childName}`}
                    color={tokens.resolveAwardText}
                    iconName="thumbs-up"
                    isActive={childAction.status === 'awarded'}
                    isDisabled={childAction.status === 'awarded'}
                    side="right"
                    onPress={() => {
                      triggerLightImpactHaptic(hapticsEnabled);
                      void resolveExpiredTimerChild(
                        childAction.childId,
                        'awarded',
                        {
                          restartTimerOnResolve: restartCountdownAfterCheckIn,
                        },
                      );
                    }}
                  />
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </KeyboardModalFrame>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    card: {
      alignSelf: 'center',
      backgroundColor: tokens.modalSurface,
      borderColor: tokens.border,
      borderRadius: 22,
      borderWidth: 1,
      flexShrink: 1,
      gap: 12,
      maxHeight: '100%',
      maxWidth: 456,
      paddingHorizontal: 14,
      paddingVertical: 18,
    },
    childList: {
      gap: 8,
    },
    childName: {
      color: tokens.textPrimary,
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '900',
      textAlign: 'center',
    },
    childRail: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 999,
      flexDirection: 'row',
      minHeight: 58,
      overflow: 'hidden',
      width: '100%',
    },
    childRailCore: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      flexBasis: 140,
      flexGrow: 1,
      flexShrink: 0,
      gap: 2,
      justifyContent: 'center',
      minWidth: 140,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    childStatus: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    eyebrow: {
      color: tokens.accent,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    lockedCopy: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    lockedState: {
      gap: 10,
    },
    resolveButton: {
      alignItems: 'center',
      alignSelf: 'stretch',
      flexGrow: 0,
      flexShrink: 0,
      justifyContent: 'center',
      width: 56,
      minWidth: 56,
      paddingHorizontal: 8,
      paddingVertical: 10,
    },
    resolveButtonActive: {
      opacity: 1,
    },
    resolveButtonDisabled: {
      opacity: 0.7,
    },
    resolveButtonIdle: {
      opacity: 1,
    },
    resolveButtonLeft: {
      backgroundColor: tokens.resolveDismissSurface,
      borderRightColor: tokens.resolveDismissBorder,
      borderRightWidth: 1,
    },
    resolveButtonRight: {
      backgroundColor: tokens.resolveAwardSurface,
      borderLeftColor: tokens.resolveAwardBorder,
      borderLeftWidth: 1,
    },
    title: {
      color: tokens.textPrimary,
      fontSize: 24,
      fontWeight: '900',
    },
    toggleCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    toggleHelper: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    toggleLabel: {
      color: tokens.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    toggleRow: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    triggeredAt: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
  });
