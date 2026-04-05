import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { stopExpiredAlarmPlayback } from '../app/alarmEngine';
import { useAppStorage } from '../app/appStorage';
import { useAppTheme } from '../theme/themeContext';

const ALARM_DEBUG_PREFIX = '[KidPointsAlarmJS]';

function logAlarmDebug(message: string, details?: unknown) {
  if (!__DEV__) {
    return;
  }

  if (details === undefined) {
    console.debug(ALARM_DEBUG_PREFIX, message);
    return;
  }

  console.debug(ALARM_DEBUG_PREFIX, message, details);
}

export function IntervalCheckInModal({
  intervalId,
  onClose,
}: {
  intervalId: string | null | undefined;
  onClose: () => void;
}) {
  const { tokens } = useAppTheme();
  const {
    appData,
    awardExpiredIntervalChild,
    dismissExpiredIntervalChild,
    resetTimer,
  } = useAppStorage();
  const activeInterval =
    intervalId === undefined
      ? null
      : (appData.expiredIntervals.find((interval) => {
          if (
            !interval.childActions.some(
              (childAction) => childAction.status === 'pending',
            )
          ) {
            return false;
          }

          if (intervalId == null) {
            return true;
          }

          return interval.intervalId === intervalId;
        }) ?? null);
  const pendingChildCount =
    activeInterval?.childActions.filter(
      (childAction) => childAction.status === 'pending',
    ).length ?? 0;

  useEffect(() => {
    if (intervalId === undefined) {
      return;
    }

    if (intervalId !== null && intervalId !== undefined && !activeInterval) {
      onClose();
      return;
    }

    if (activeInterval == null) {
      return;
    }

    logAlarmDebug('IntervalCheckInModal visible', {
      intervalId: activeInterval.intervalId,
      pendingChildren: pendingChildCount,
      triggeredAt: activeInterval.triggeredAt,
    });

    return () => {
      logAlarmDebug('IntervalCheckInModal hidden', {
        intervalId: activeInterval.intervalId,
      });
    };
  }, [activeInterval, intervalId, onClose, pendingChildCount]);

  if (
    intervalId === undefined ||
    !activeInterval ||
    (intervalId !== null &&
      intervalId !== undefined &&
      activeInterval.intervalId !== intervalId)
  ) {
    return null;
  }

  const pendingChildActions = activeInterval.childActions.filter(
    (childAction) => childAction.status === 'pending',
  );

  return (
    <Modal animationType="fade" transparent visible onRequestClose={() => {}}>
      <View
        style={[
          styles.modalBackdrop,
          { backgroundColor: tokens.modalBackdrop },
        ]}
      >
        <View
          style={[styles.modalCard, { backgroundColor: tokens.modalSurface }]}
        >
          <Text style={[styles.modalTitle, { color: tokens.textPrimary }]}>
            Timer complete
          </Text>
          <Text style={[styles.modalBody, { color: tokens.textMuted }]}>
            Review this round and award points from inside the app.
          </Text>

          <View style={styles.childList}>
            {pendingChildActions.map((childAction) => (
              <View
                key={`${activeInterval.intervalId}:${childAction.childId}`}
                style={[
                  styles.childRow,
                  {
                    backgroundColor: tokens.inputSurface,
                    borderColor: tokens.border,
                  },
                ]}
              >
                <Text style={[styles.childName, { color: tokens.textPrimary }]}>
                  {childAction.childName}
                </Text>
                <View style={styles.childActions}>
                  <Pressable
                    accessibilityLabel={`Award ${childAction.childName}`}
                    onPress={() => {
                      logAlarmDebug('Thumbs up pressed', {
                        childId: childAction.childId,
                        intervalId: activeInterval.intervalId,
                      });
                      void stopExpiredAlarmPlayback();
                      awardExpiredIntervalChild(
                        activeInterval.intervalId,
                        childAction.childId,
                      );
                    }}
                    style={[styles.iconButton, styles.awardButton]}
                  >
                    <MaterialIcons
                      color="#f8fafc"
                      name="thumb-up-alt"
                      size={18}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Dismiss ${childAction.childName}`}
                    onPress={() => {
                      logAlarmDebug('Thumbs down pressed', {
                        childId: childAction.childId,
                        intervalId: activeInterval.intervalId,
                      });
                      void stopExpiredAlarmPlayback();
                      dismissExpiredIntervalChild(
                        activeInterval.intervalId,
                        childAction.childId,
                      );
                    }}
                    style={[
                      styles.iconButton,
                      { backgroundColor: tokens.controlSurface },
                    ]}
                  >
                    <Feather
                      color={tokens.controlText}
                      name="thumbs-down"
                      size={18}
                    />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.footerActions}>
            <Pressable
              onPress={() => {
                logAlarmDebug('Stop timer pressed from check-in modal', {
                  intervalId: activeInterval.intervalId,
                });
                void stopExpiredAlarmPlayback();
                resetTimer();
              }}
              style={styles.stopButton}
            >
              <Text style={styles.stopButtonText}>Stop timer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  childList: {
    gap: 10,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  childName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
  },
  childActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  awardButton: {
    backgroundColor: '#0f766e',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  stopButton: {
    borderRadius: 999,
    backgroundColor: '#b91c1c',
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  stopButtonText: {
    color: '#f8fafc',
    fontWeight: '800',
  },
});
