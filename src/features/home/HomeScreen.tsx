import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { LoggedPressable } from '../../components/LoggedPressable';
import { MainScreenActions } from '../../components/MainScreenActions';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  ActionPillRow,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { createModuleLogger } from '../../logging/logger';
import { useSharedStore } from '../../state/sharedStore';
import { presentTextInputModal } from '../overlays/textInputModalStore';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';
import { TimerControlRail } from '../timer/TimerControlRail';
import { useSharedTimerViewModel } from '../timer/useSharedTimerViewModel';

const log = createModuleLogger('home-screen');

export function HomeScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked } = useParentSession();
  const { tokens } = useAppTheme();
  const head = useSharedStore((state) => state.document.head);
  const addChild = useSharedStore((state) => state.addChild);
  const adjustPoints = useSharedStore((state) => state.adjustPoints);
  const archiveChild = useSharedStore((state) => state.archiveChild);
  const pauseTimer = useSharedStore((state) => state.pauseTimer);
  const resetTimer = useSharedStore((state) => state.resetTimer);
  const setPoints = useSharedStore((state) => state.setPoints);
  const startTimer = useSharedStore((state) => state.startTimer);
  const timerViewModel = useSharedTimerViewModel();
  const activeChildren = useMemo(
    () =>
      head.activeChildIds
        .map((childId) => head.childrenById[childId])
        .filter(Boolean),
    [head],
  );

  useEffect(() => {
    log.debug('Home screen initialized');
  }, []);

  const openAddChildModal = () => {
    presentTextInputModal({
      confirmLabel: 'Add Child',
      description: 'What is the name of the child to add?',
      initialValue: '',
      inputAccessibilityLabel: 'Child Name',
      onSubmit: (nextValue) => addChild(nextValue),
      title: 'Add Child',
    });
  };

  const openEditPointTotalModal = (
    childId: string,
    childName: string,
    points: number,
  ) => {
    presentTextInputModal({
      confirmLabel: 'Save Total',
      description: `Set the exact point total for ${childName}.`,
      initialValue: String(points),
      inputAccessibilityLabel: 'Exact Point Total',
      keyboardType: 'number-pad',
      onSubmit: (nextValue) => {
        if (!/^-?\d+$/.test(nextValue.trim())) {
          return {
            error: 'Enter a whole-number point total.',
            ok: false,
          } as const;
        }

        return setPoints(childId, Number(nextValue.trim()));
      },
      placeholder: '0',
      title: 'Edit Point Total',
    });
  };

  const openAlarmScreen = () => {
    if (!isParentUnlocked) {
      router.push('/parent-unlock');
      return;
    }

    router.push('/alarm');
  };

  return (
    <ScreenScaffold>
      <ScreenHeader
        actions={<MainScreenActions />}
        title="Home"
        titleIcon={
          <Ionicons color={tokens.textPrimary} name="home-outline" size={24} />
        }
      />

      <Tile
        accessory={
          <StatusBadge
            label={timerViewModel.statusLabel}
            tone={timerViewModel.statusTone}
          />
        }
        summary={
          <View style={styles.timerSummary}>
            <View style={styles.timerSummaryCopy}>
              <View style={styles.timerValueWrap}>
                <Text style={styles.primaryMetric}>
                  {timerViewModel.remainingLabel}
                </Text>
              </View>
              <View style={styles.timerMetaRow}>
                <Text style={styles.timerMeta}>
                  {timerViewModel.cadenceLabel}
                </Text>
                <Text style={styles.timerMeta}>
                  {timerViewModel.alarmDurationLabel}
                </Text>
              </View>
            </View>
            <LoggedPressable
              accessibilityLabel={
                isParentUnlocked
                  ? 'Open alarm settings'
                  : 'Unlock parent mode for alarm settings'
              }
              logContext={{ isParentUnlocked }}
              logLabel={
                isParentUnlocked
                  ? 'Open alarm settings'
                  : 'Unlock parent mode for alarm settings'
              }
              onPress={openAlarmScreen}
              style={styles.summaryIconAction}
            >
              <Feather color={tokens.controlText} name="clock" size={16} />
            </LoggedPressable>
          </View>
        }
        title="Check-In"
      >
        {isParentUnlocked ? (
          <TimerControlRail
            contextLabel="Home"
            onPause={() => {
              pauseTimer();
            }}
            onReset={() => {
              resetTimer();
            }}
            onStart={() => {
              startTimer();
            }}
            pauseDisabled={!timerViewModel.canPause}
            resetDisabled={!timerViewModel.canReset}
            startDisabled={!timerViewModel.canStart}
          />
        ) : (
          <ActionPillRow>
            <ActionPill
              label="Unlock To Control"
              onPress={() => router.push('/parent-unlock')}
              tone="primary"
            />
          </ActionPillRow>
        )}
      </Tile>

      {activeChildren.length === 0 ? (
        <Tile title="Add Child">
          <View style={styles.emptyStateColumn}>
            <Text style={styles.emptyStateCopy}>
              Add a child to get started!
            </Text>
            <ActionPill
              label={isParentUnlocked ? 'Add Child' : 'Unlock To Add'}
              onPress={() => {
                if (isParentUnlocked) {
                  openAddChildModal();
                  return;
                }

                router.push('/parent-unlock');
              }}
              tone="primary"
            />
          </View>
        </Tile>
      ) : null}

      {activeChildren.map((child) => (
        <Tile
          collapsible={isParentUnlocked}
          initiallyCollapsed={isParentUnlocked}
          key={child.id}
          summary={
            <View style={styles.pointsSummary}>
              <View
                style={[
                  styles.pointsRail,
                  !isParentUnlocked && styles.pointsRailLocked,
                ]}
              >
                {isParentUnlocked ? (
                  <LoggedPressable
                    accessibilityLabel={`Decrease ${child.name} points`}
                    accessibilityRole="button"
                    logContext={{
                      childId: child.id,
                      childName: child.name,
                      delta: -1,
                    }}
                    logLabel={`Decrease ${child.name} points`}
                    onPress={() => {
                      adjustPoints(child.id, -1);
                    }}
                    style={[styles.pointsSegment, styles.pointsCapLeft]}
                  >
                    <Text
                      style={[styles.pointsCapText, styles.pointsCapTextLeft]}
                    >
                      -1
                    </Text>
                  </LoggedPressable>
                ) : null}
                <LoggedPressable
                  accessibilityLabel={`Edit ${child.name} points`}
                  accessibilityRole="button"
                  logContext={{
                    childId: child.id,
                    childName: child.name,
                    points: child.points,
                  }}
                  logLabel={`Edit ${child.name} points`}
                  onPress={() => {
                    if (!isParentUnlocked) {
                      router.push('/parent-unlock');
                      return;
                    }

                    openEditPointTotalModal(child.id, child.name, child.points);
                  }}
                  style={[
                    styles.pointsCore,
                    !isParentUnlocked && styles.pointsCoreLocked,
                  ]}
                >
                  <Text style={styles.pointsValue}>{child.points}</Text>
                </LoggedPressable>
                {isParentUnlocked ? (
                  <LoggedPressable
                    accessibilityLabel={`Increase ${child.name} points`}
                    accessibilityRole="button"
                    logContext={{
                      childId: child.id,
                      childName: child.name,
                      delta: 1,
                    }}
                    logLabel={`Increase ${child.name} points`}
                    onPress={() => {
                      adjustPoints(child.id, 1);
                    }}
                    style={[styles.pointsSegment, styles.pointsCapRight]}
                  >
                    <Text
                      style={[styles.pointsCapText, styles.pointsCapTextRight]}
                    >
                      +1
                    </Text>
                  </LoggedPressable>
                ) : null}
              </View>
            </View>
          }
          title={child.name}
        >
          {isParentUnlocked ? (
            <ActionPillRow>
              <ActionPill
                label="Archive"
                onPress={() => {
                  Alert.alert(
                    'Archive Child',
                    `${child.name} will be removed from Home, but their recorded transactions and data will stay available so you can restore them later.`,
                    [
                      { style: 'cancel', text: 'Cancel' },
                      {
                        onPress: () => {
                          archiveChild(child.id);
                        },
                        style: 'destructive',
                        text: 'Archive',
                      },
                    ],
                  );
                }}
                tone="critical"
              />
            </ActionPillRow>
          ) : null}
        </Tile>
      ))}

      <Tile collapsible initiallyCollapsed title="Parent">
        {isParentUnlocked ? (
          <ActionPillRow>
            <ActionPill label="Add Child" onPress={openAddChildModal} />
            <ActionPill
              label="Archived Children"
              onPress={() => router.push('/list-browser')}
            />
            <ActionPill
              label="Transactions"
              onPress={() => router.push('/transactions')}
            />
          </ActionPillRow>
        ) : (
          <ActionPillRow>
            <ActionPill
              label="Unlock with PIN"
              onPress={() => router.push('/parent-unlock')}
              tone="primary"
            />
          </ActionPillRow>
        )}
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
    emptyStateColumn: {
      gap: 10,
    },
    emptyStateCopy: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    timerSummary: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      minWidth: 0,
    },
    timerSummaryCopy: {
      flex: 1,
      gap: 4,
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
    timerMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    timerMeta: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    summaryIconAction: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 16,
      flexShrink: 0,
      height: 32,
      justifyContent: 'center',
      width: 32,
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
    pointsRailLocked: {
      alignSelf: 'flex-start',
    },
    pointsSegment: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    pointsCapLeft: {
      backgroundColor: resolvedTheme === 'dark' ? '#562646' : '#ffd7eb',
      borderRightColor: resolvedTheme === 'dark' ? '#7c3a63' : '#f4b6d6',
      borderRightWidth: 1,
      flexBasis: 0,
      flexGrow: 2,
    },
    pointsCapRight: {
      backgroundColor: resolvedTheme === 'dark' ? '#1f3560' : '#dbe8ff',
      borderLeftColor: resolvedTheme === 'dark' ? '#33528d' : '#bccffb',
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
    pointsCoreLocked: {
      borderRadius: 999,
      flexBasis: 'auto',
      flexGrow: 0,
      minWidth: 110,
    },
    pointsCapText: {
      fontSize: 14,
      fontWeight: '800',
    },
    pointsCapTextLeft: {
      color: resolvedTheme === 'dark' ? '#ffe5f1' : '#8a1d55',
    },
    pointsCapTextRight: {
      color: resolvedTheme === 'dark' ? '#e2ecff' : '#23458f',
    },
    pointsValue: {
      color: tokens.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
  });
