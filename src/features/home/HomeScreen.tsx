import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { MainScreenActions } from '../../components/MainScreenActions';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { ActionPill, ActionPillRow } from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { createModuleLogger } from '../../logging/logger';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import { useSharedStore } from '../../state/sharedStore';
import { useNotifications } from '../notifications/NotificationsProvider';
import { presentTextInputModal } from '../overlays/textInputModalStore';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import { CompactCountdownTile } from '../timer/CompactCountdownTile';
import { useSharedTimerViewModel } from '../timer/useSharedTimerViewModel';
import { ArchivedChildrenOverlay } from './ArchivedChildrenOverlay';
import { ChildPointsRail } from './ChildPointsRail';

const log = createModuleLogger('home-screen');

export function HomeScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked } = useParentSession();
  const { tokens } = useAppTheme();
  const developerModeEnabled = useLocalSettingsStore(
    (state) => state.developerModeEnabled,
  );
  const head = useSharedStore((state) => state.document.head);
  const addChild = useSharedStore((state) => state.addChild);
  const adjustPoints = useSharedStore((state) => state.adjustPoints);
  const archiveChild = useSharedStore((state) => state.archiveChild);
  const pauseTimer = useSharedStore((state) => state.pauseTimer);
  const resetTimer = useSharedStore((state) => state.resetTimer);
  const setPoints = useSharedStore((state) => state.setPoints);
  const { requestTimerStart } = useNotifications();
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
  const archivedChildren = useMemo(
    () =>
      head.archivedChildIds
        .map((childId) => head.childrenById[childId])
        .filter(Boolean),
    [head],
  );
  const hasArchivedChildren = archivedChildren.length > 0;

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

  const openSyncDevices = () => {
    if (!isParentUnlocked) {
      router.navigate('/parent-unlock');
      return;
    }

    router.navigate('/sync');
  };

  return (
    <View style={styles.screenRoot}>
      <ScreenScaffold>
        <ScreenHeader
          actions={<MainScreenActions onPressSyncDevices={openSyncDevices} />}
          title="Home"
          titleIcon={
            <Ionicons
              color={tokens.textPrimary}
              name="home-outline"
              size={24}
            />
          }
        />

        <CompactCountdownTile
          contextLabel="Home"
          isParentUnlocked={isParentUnlocked}
          onPause={() => {
            pauseTimer();
          }}
          onReset={() => {
            resetTimer();
          }}
          onStart={() => {
            void requestTimerStart('home');
          }}
          onUnlock={() => router.navigate('/parent-unlock')}
          pauseDisabled={!timerViewModel.canPause}
          remainingLabel={timerViewModel.remainingLabel}
          resetDisabled={!timerViewModel.canReset}
          startDisabled={!timerViewModel.canStart}
          statusLabel={timerViewModel.statusLabel}
          statusTone={timerViewModel.statusTone}
        />

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

                  router.navigate('/parent-unlock');
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
                    router.navigate('/parent-unlock');
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
              {hasArchivedChildren ? (
                <ActionPill
                  label="Unarchive Child"
                  onPress={() => {
                    setIsArchivedChildrenVisible(true);
                  }}
                />
              ) : null}
              <ActionPill
                label="Transactions"
                onPress={() => router.navigate('/transactions')}
              />
            </ActionPillRow>
          ) : (
            <ActionPillRow>
              <ActionPill
                label="Unlock with PIN"
                onPress={() => router.navigate('/parent-unlock')}
                tone="primary"
              />
            </ActionPillRow>
          )}
        </Tile>

        {developerModeEnabled ? (
          <Tile collapsible initiallyCollapsed title="Developer">
            <ActionPillRow>
              <ActionPill
                pressDebounceMs={750}
                label="Sync Testbed"
                onPress={() => router.navigate('/sync-testbed')}
              />
              <ActionPill
                pressDebounceMs={750}
                label="Logs"
                onPress={() => router.navigate('/logs')}
              />
            </ActionPillRow>
          </Tile>
        ) : null}
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
    screenRoot: {
      flex: 1,
    },
  });
