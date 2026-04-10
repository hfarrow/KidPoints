import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import { CountdownTileSummary } from '../timer/CountdownTileSummary';
import { TimerControlRail } from '../timer/TimerControlRail';
import { useSharedTimerViewModel } from '../timer/useSharedTimerViewModel';
import { ArchivedChildrenOverlay } from './ArchivedChildrenOverlay';
import { ChildPointsRail } from './ChildPointsRail';

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
  const [isArchivedChildrenVisible, setIsArchivedChildrenVisible] =
    useState(false);
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
    <View style={styles.screenRoot}>
      <ScreenScaffold>
        <ScreenHeader
          actions={<MainScreenActions />}
          title="Home"
          titleIcon={
            <Ionicons
              color={tokens.textPrimary}
              name="home-outline"
              size={24}
            />
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
            <CountdownTileSummary
              remainingLabel={timerViewModel.remainingLabel}
              statusLabel={timerViewModel.statusLabel}
              statusTone={timerViewModel.statusTone}
              trailingAction={
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
                  <Feather
                    color={tokens.controlText}
                    name="settings"
                    size={16}
                  />
                </LoggedPressable>
              }
            />
          }
          title="Countdown"
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
              <ChildPointsRail
                childId={child.id}
                childName={child.name}
                isParentUnlocked={isParentUnlocked}
                onAdjustPoints={(delta) => adjustPoints(child.id, delta)}
                onEditPoints={() => {
                  if (!isParentUnlocked) {
                    router.push('/parent-unlock');
                    return;
                  }

                  openEditPointTotalModal(child.id, child.name, child.points);
                }}
                points={child.points}
              />
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
                onPress={() => {
                  setIsArchivedChildrenVisible(true);
                }}
              />
              <ActionPill
                label="Sync Devices"
                onPress={() => router.push('/sync')}
                tone="primary"
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
      <ArchivedChildrenOverlay
        onRequestClose={() => {
          setIsArchivedChildrenVisible(false);
        }}
        visible={isArchivedChildrenVisible}
      />
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    emptyStateColumn: {
      gap: 10,
    },
    emptyStateCopy: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
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
    screenRoot: {
      flex: 1,
    },
  });
