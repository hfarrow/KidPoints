import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { MainScreenActions } from '../../components/MainScreenActions';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  ActionPillRow,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import {
  selectHomeTimerSummary,
  useSharedStore,
} from '../../state/sharedStore';
import { presentTextInputModal } from '../overlays/textInputModalStore';
import { useParentSession } from '../parent/parentSessionContext';
import { type useAppTheme, useThemedStyles } from '../theme/themeContext';

export function HomeScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked } = useParentSession();
  const head = useSharedStore((state) => state.document.head);
  const homeTimerSummary = useSharedStore(selectHomeTimerSummary);
  const addChild = useSharedStore((state) => state.addChild);
  const adjustPoints = useSharedStore((state) => state.adjustPoints);
  const archiveChild = useSharedStore((state) => state.archiveChild);
  const setPoints = useSharedStore((state) => state.setPoints);
  const activeChildren = useMemo(
    () =>
      head.activeChildIds
        .map((childId) => head.childrenById[childId])
        .filter(Boolean),
    [head],
  );

  const openAddChildModal = () => {
    presentTextInputModal({
      confirmLabel: 'Add Child',
      description: 'Add a child tile to the home screen.',
      initialValue: '',
      inputAccessibilityLabel: 'Child Name',
      onSubmit: (nextValue) => addChild(nextValue),
      title: 'Add Child',
    });
    router.push('/text-input-modal');
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
    router.push('/text-input-modal');
  };

  return (
    <ScreenScaffold>
      <ScreenHeader actions={<MainScreenActions />} title="Home" />

      <Tile
        accessory={
          <StatusBadge label={homeTimerSummary.statusLabel} tone="neutral" />
        }
        summary={
          <View style={styles.timerSummary}>
            <View style={styles.timerValueWrap}>
              <Text style={styles.primaryMetric}>
                {homeTimerSummary.remainingLabel}
              </Text>
            </View>
            <Text style={styles.timerMeta}>
              {homeTimerSummary.intervalLabel}
            </Text>
          </View>
        }
        title="Check-In"
      >
        <Text style={styles.bodyCopy}>
          Alarm behavior will connect here next. For now, Home reads a stable
          timer summary from the shared document.
        </Text>
      </Tile>

      {activeChildren.length === 0 ? (
        <Tile title="Add Child">
          <View style={styles.emptyStateColumn}>
            <Text style={styles.emptyStateCopy}>
              Add a child to get started!
            </Text>
            <ActionPill
              label={isParentUnlocked ? 'Add child' : 'Unlock to add'}
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
          collapsible
          initiallyCollapsed
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
                  <Pressable
                    accessibilityLabel={`Decrease ${child.name} points`}
                    accessibilityRole="button"
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
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityLabel={`Edit ${child.name} points`}
                  accessibilityRole="button"
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
                </Pressable>
                {isParentUnlocked ? (
                  <Pressable
                    accessibilityLabel={`Increase ${child.name} points`}
                    accessibilityRole="button"
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
                  </Pressable>
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
                    'Archive child',
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
          ) : (
            <>
              <Text style={styles.bodyCopy}>
                Tap the points capsule or unlock Parent Mode to manage this
                child.
              </Text>
              <ActionPill
                label="Unlock Parent Mode"
                onPress={() => router.push('/parent-unlock')}
                tone="primary"
              />
            </>
          )}
        </Tile>
      ))}

      <Tile collapsible initiallyCollapsed title="Parent">
        {isParentUnlocked ? (
          <ActionPillRow>
            <ActionPill
              label="Add child"
              onPress={openAddChildModal}
              tone="primary"
            />
            <ActionPill
              label="Archived children"
              onPress={() => router.push('/list-browser')}
            />
          </ActionPillRow>
        ) : (
          <>
            <Text style={styles.bodyCopy}>
              Parent tools stay available here once the local unlock prompt has
              been completed.
            </Text>
            <ActionPillRow>
              <ActionPill
                label="Unlock with PIN"
                onPress={() => router.push('/parent-unlock')}
                tone="primary"
              />
            </ActionPillRow>
          </>
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
    bodyCopy: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    timerSummary: {
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
    timerMeta: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: '800',
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
