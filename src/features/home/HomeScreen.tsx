import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListModal } from '../../components/ListModal';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Tile } from '../../components/Tile';
import { useAppStorage } from '../app/appStorage';
import { formatDuration } from '../app/timer';
import { useParentUnlockAction } from '../app/useParentUnlockAction';
import { useAppTheme } from '../theme/themeContext';

export function HomeScreen() {
  const router = useRouter();
  const { getScreenSurface, tokens } = useAppTheme();
  const {
    addChild,
    archiveChild,
    archivedChildren,
    children,
    deleteChildPermanently,
    decrementPoints,
    incrementPoints,
    isHydrated,
    moveChild,
    parentSession,
    pauseTimer,
    renameChild,
    resetTimer,
    restoreChild,
    setPoints,
    startTimer,
    timerSnapshot,
  } = useAppStorage();
  const [childName, setChildName] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [archivedChildrenVisible, setArchivedChildrenVisible] = useState(false);
  const [pointEditor, setPointEditor] = useState<{
    childId: string;
    displayName: string;
    value: string;
  } | null>(null);
  const [childSettingsEditor, setChildSettingsEditor] = useState<{
    childId: string;
    value: string;
  } | null>(null);
  const isParentUnlocked = parentSession.isUnlocked;
  const { parentPinModal, requestParentUnlock } = useParentUnlockAction();
  const saveChildSettingsName = ({
    childId,
    currentName,
    nextName,
  }: {
    childId: string;
    currentName: string;
    nextName: string;
  }) => {
    const trimmedName = nextName.trim();

    if (!trimmedName || trimmedName === currentName) {
      return;
    }

    renameChild(childId, trimmedName);
  };

  useEffect(() => {
    if (archivedChildrenVisible && archivedChildren.length === 0) {
      setArchivedChildrenVisible(false);
    }
  }, [archivedChildren, archivedChildrenVisible]);

  if (!isHydrated) {
    return (
      <SafeAreaView
        edges={['top']}
        style={[
          styles.safeArea,
          { backgroundColor: getScreenSurface(isParentUnlocked) },
        ]}
      >
        <View style={styles.loadingState}>
          <Text style={[styles.loadingTitle, { color: tokens.textPrimary }]}>
            Preparing KidPoints...
          </Text>
          <Text style={[styles.loadingBody, { color: tokens.textMuted }]}>
            Loading saved kids, timer settings, and parent controls.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safeArea,
        { backgroundColor: getScreenSurface(isParentUnlocked) },
      ]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Home"
          subtitle="Track the shared interval and keep each kid's points in view."
        />

        <Tile
          collapsible={false}
          floatingTitle
          headerAccessory={
            isParentUnlocked ? (
              <Pressable
                onPress={() => router.push('/alarm')}
                style={[
                  styles.iconAction,
                  { backgroundColor: tokens.controlSurface },
                ]}
              >
                <Text
                  style={[styles.iconActionText, { color: tokens.controlText }]}
                >
                  {'\u2699'}
                </Text>
              </Pressable>
            ) : null
          }
          summaryVisibleWhenExpanded
          title="Alarm"
          collapsedSummary={
            <View style={styles.timerSummary}>
              <Pressable
                accessibilityLabel="Open alarm settings"
                onPress={() => requestParentUnlock()}
                style={styles.timerValueButton}
              >
                <Text
                  style={[styles.timerValue, { color: tokens.textPrimary }]}
                >
                  {formatDuration(timerSnapshot.remainingMs)}
                </Text>
              </Pressable>
              {isParentUnlocked ? (
                <View
                  style={[
                    styles.timerControlsRail,
                    { backgroundColor: tokens.controlSurface },
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      if (timerSnapshot.isRunning) {
                        pauseTimer();
                        return;
                      }

                      startTimer();
                    }}
                    style={[
                      styles.timerControlSegment,
                      styles.timerControlSegmentLeft,
                      { borderRightColor: tokens.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timerActionText,
                        { color: tokens.controlText },
                      ]}
                    >
                      {timerSnapshot.isRunning ? 'Pause' : 'Start'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={resetTimer}
                    style={[
                      styles.timerControlSegment,
                      styles.timerControlSegmentRight,
                      { borderLeftColor: tokens.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timerActionText,
                        { color: tokens.controlText },
                      ]}
                    >
                      Reset
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          }
        />

        {children.length === 0 ? (
          <Tile title="No child widgets yet">
            <Text style={[styles.supportingText, { color: tokens.textMuted }]}>
              Unlock Parent Mode to add the first child widget to this shared
              dashboard.
            </Text>
            {isParentUnlocked ? (
              <Pressable
                onPress={() => setAddModalVisible(true)}
                style={styles.primaryAction}
              >
                <Text style={styles.primaryActionText}>Add a child</Text>
              </Pressable>
            ) : null}
          </Tile>
        ) : null}

        {children.map((child, index) => {
          const isEditingSettings = childSettingsEditor?.childId === child.id;

          if (isEditingSettings) {
            return (
              <Tile
                key={child.id}
                collapsible={false}
                floatingTitle
                summaryVisibleWhenExpanded
                title={`${child.displayName} settings`}
              >
                <View style={styles.settingsList}>
                  <View style={styles.settingsActionRow}>
                    <Pressable
                      accessibilityLabel={`Save ${child.displayName} settings`}
                      onPress={() => {
                        saveChildSettingsName({
                          childId: child.id,
                          currentName: child.displayName,
                          nextName: childSettingsEditor.value,
                        });
                        setChildSettingsEditor(null);
                      }}
                      style={[
                        styles.settingsSaveAction,
                        { backgroundColor: tokens.controlSurface },
                      ]}
                    >
                      <Text
                        style={[
                          styles.settingsSaveActionText,
                          { color: tokens.controlText },
                        ]}
                      >
                        Save
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={index === 0}
                      onPress={() => moveChild(child.id, 'up')}
                      style={[
                        styles.secondaryAction,
                        styles.settingsCompactAction,
                        { backgroundColor: tokens.controlSurface },
                        index === 0 && styles.disabledAction,
                      ]}
                    >
                      <Text
                        style={[
                          styles.secondaryActionText,
                          { color: tokens.controlText },
                        ]}
                      >
                        Move up
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={index === children.length - 1}
                      onPress={() => moveChild(child.id, 'down')}
                      style={[
                        styles.secondaryAction,
                        styles.settingsCompactAction,
                        { backgroundColor: tokens.controlSurface },
                        index === children.length - 1 && styles.disabledAction,
                      ]}
                    >
                      <Text
                        style={[
                          styles.secondaryActionText,
                          { color: tokens.controlText },
                        ]}
                      >
                        Move down
                      </Text>
                    </Pressable>
                  </View>
                  <View
                    style={[styles.settingRow, { borderColor: tokens.border }]}
                  >
                    <Text
                      style={[
                        styles.settingLabel,
                        { color: tokens.textPrimary },
                      ]}
                    >
                      Name:
                    </Text>
                    <TextInput
                      accessibilityLabel={`Child name for ${child.displayName}`}
                      onBlur={() =>
                        saveChildSettingsName({
                          childId: child.id,
                          currentName: child.displayName,
                          nextName: childSettingsEditor.value,
                        })
                      }
                      onChangeText={(value) =>
                        setChildSettingsEditor((current) =>
                          current
                            ? {
                                ...current,
                                value,
                              }
                            : null,
                        )
                      }
                      placeholder="Child name"
                      placeholderTextColor={tokens.textMuted}
                      style={[
                        styles.settingInput,
                        {
                          backgroundColor: tokens.inputSurface,
                          color: tokens.textPrimary,
                        },
                      ]}
                      value={childSettingsEditor.value}
                    />
                  </View>
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        'Archive child',
                        `${child.displayName} will be removed from the dashboard, but all of their data will be preserved so you can restore them later.`,
                        [
                          { style: 'cancel', text: 'Cancel' },
                          {
                            style: 'destructive',
                            text: 'Archive',
                            onPress: () => {
                              archiveChild(child.id);
                              setChildSettingsEditor(null);
                            },
                          },
                        ],
                      )
                    }
                    style={styles.dangerAction}
                  >
                    <Text style={styles.dangerActionText}>Archive child</Text>
                  </Pressable>
                </View>
              </Tile>
            );
          }

          return (
            <Tile
              key={child.id}
              collapsible={false}
              headerAccessory={
                isParentUnlocked ? (
                  <Pressable
                    accessibilityLabel={`Open ${child.displayName} settings`}
                    onPress={() =>
                      setChildSettingsEditor({
                        childId: child.id,
                        value: child.displayName,
                      })
                    }
                    style={[
                      styles.iconAction,
                      { backgroundColor: tokens.controlSurface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.iconActionText,
                        { color: tokens.controlText },
                      ]}
                    >
                      {'\u2699'}
                    </Text>
                  </Pressable>
                ) : null
              }
              collapsedSummary={
                <View style={styles.collapsedChildSummary}>
                  <View
                    style={[
                      styles.childControlsRail,
                      { backgroundColor: tokens.controlSurface },
                    ]}
                  >
                    {isParentUnlocked ? (
                      <Pressable
                        disabled={!isParentUnlocked}
                        onPress={() => decrementPoints(child.id)}
                        style={[
                          styles.childSegment,
                          styles.childActionSegment,
                          styles.childActionSegmentLeft,
                        ]}
                      >
                        <Text style={styles.childActionText}>-</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityLabel={`Edit ${child.displayName} points`}
                      onPress={() => {
                        if (!isParentUnlocked) {
                          requestParentUnlock();
                          return;
                        }

                        setPointEditor({
                          childId: child.id,
                          displayName: child.displayName,
                          value: String(child.points),
                        });
                      }}
                      style={[
                        styles.childSegment,
                        styles.childPointsSegment,
                        { backgroundColor: tokens.inputSurface },
                      ]}
                    >
                      <Text
                        style={[
                          styles.childPointsValue,
                          { color: tokens.textPrimary },
                        ]}
                      >
                        {child.points}
                      </Text>
                    </Pressable>
                    {isParentUnlocked ? (
                      <Pressable
                        disabled={!isParentUnlocked}
                        onPress={() => incrementPoints(child.id)}
                        style={[
                          styles.childSegment,
                          styles.childActionSegment,
                          styles.childActionSegmentRight,
                        ]}
                      >
                        <Text style={styles.childActionText}>+</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              }
              floatingTitle
              summaryVisibleWhenExpanded
              title={child.displayName}
            />
          );
        })}

        {isParentUnlocked ? (
          <Tile initiallyCollapsed title="Parent tools">
            <View style={styles.parentToolsActions}>
              <Pressable
                onPress={() => setAddModalVisible(true)}
                style={styles.primaryAction}
              >
                <Text style={styles.primaryActionText}>Add child widget</Text>
              </Pressable>
              {archivedChildren.length > 0 ? (
                <Pressable
                  onPress={() => setArchivedChildrenVisible(true)}
                  style={[
                    styles.secondaryAction,
                    { backgroundColor: tokens.controlSurface },
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryActionText,
                      { color: tokens.controlText },
                    ]}
                  >
                    Show archived children
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Tile>
        ) : null}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={addModalVisible}
        onRequestClose={() => setAddModalVisible(false)}
      >
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
              Add child widget
            </Text>
            <TextInput
              accessibilityLabel="Child name"
              onChangeText={setChildName}
              placeholder="Child name"
              placeholderTextColor={tokens.textMuted}
              style={[
                styles.modalInput,
                {
                  backgroundColor: tokens.inputSurface,
                  borderColor: tokens.border,
                  color: tokens.textPrimary,
                },
              ]}
              value={childName}
            />
            <View style={styles.inlineActions}>
              <Pressable
                onPress={() => {
                  setChildName('');
                  setAddModalVisible(false);
                }}
                style={[
                  styles.secondaryAction,
                  { backgroundColor: tokens.controlSurface },
                ]}
              >
                <Text
                  style={[
                    styles.secondaryActionText,
                    { color: tokens.controlText },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  addChild(childName);
                  setChildName('');
                  setAddModalVisible(false);
                }}
                style={styles.primaryAction}
              >
                <Text style={styles.primaryActionText}>Add child</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {parentPinModal}

      <ListModal
        data={archivedChildren}
        emptyMessage="Archived children will appear here whenever you archive a child tile."
        keyExtractor={(child) => child.id}
        onClose={() => setArchivedChildrenVisible(false)}
        renderItem={(child) => (
          <View style={styles.archivedChildRow}>
            <View style={styles.archivedChildCopy}>
              <Text
                style={[
                  styles.archivedChildName,
                  { color: tokens.textPrimary },
                ]}
              >
                {child.displayName}
              </Text>
              <Text
                style={[styles.archivedChildMeta, { color: tokens.textMuted }]}
              >
                {child.points} point{child.points === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.archivedChildActions}>
              <Pressable
                accessibilityLabel={`Restore ${child.displayName}`}
                onPress={() => restoreChild(child.id)}
                style={[
                  styles.archivedChildIconButton,
                  { backgroundColor: tokens.controlSurface },
                ]}
              >
                <Text
                  style={[
                    styles.archivedChildIconButtonText,
                    { color: tokens.controlText },
                  ]}
                >
                  {'\u21ba'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Delete ${child.displayName} permanently`}
                onPress={() =>
                  Alert.alert(
                    'Delete child permanently',
                    `Delete ${child.displayName} permanently? All data for this child will be deleted and cannot be restored.`,
                    [
                      { style: 'cancel', text: 'Cancel' },
                      {
                        style: 'destructive',
                        text: 'Delete permanently',
                        onPress: () => {
                          deleteChildPermanently(child.id);
                        },
                      },
                    ],
                  )
                }
                style={[
                  styles.archivedChildIconButton,
                  styles.archivedChildDeleteButton,
                ]}
              >
                <Text style={styles.archivedChildDeleteButtonText}>
                  {'\ud83d\uddd1'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
        title="Archived children"
        visible={archivedChildrenVisible}
      />

      <Modal
        animationType="fade"
        transparent
        visible={pointEditor !== null}
        onRequestClose={() => setPointEditor(null)}
      >
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
              {pointEditor?.displayName ?? 'Set points'}
            </Text>
            <TextInput
              accessibilityLabel="Exact points"
              keyboardType="number-pad"
              onChangeText={(value) => {
                setPointEditor((current) =>
                  current
                    ? {
                        ...current,
                        value,
                      }
                    : null,
                );
              }}
              placeholder="Enter a point total"
              placeholderTextColor={tokens.textMuted}
              style={[
                styles.modalInput,
                {
                  backgroundColor: tokens.inputSurface,
                  borderColor: tokens.border,
                  color: tokens.textPrimary,
                },
              ]}
              value={pointEditor?.value ?? ''}
            />
            <View style={styles.inlineActions}>
              <Pressable
                onPress={() => setPointEditor(null)}
                style={[
                  styles.secondaryAction,
                  { backgroundColor: tokens.controlSurface },
                ]}
              >
                <Text
                  style={[
                    styles.secondaryActionText,
                    { color: tokens.controlText },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!pointEditor) {
                    return;
                  }

                  setPoints(
                    pointEditor.childId,
                    Number.parseInt(pointEditor.value || '0', 10),
                  );
                  setPointEditor(null);
                }}
                style={styles.primaryAction}
              >
                <Text style={styles.primaryActionText}>Save points</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '900',
  },
  loadingBody: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  supportingText: {
    fontSize: 15,
    lineHeight: 22,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  primaryAction: {
    borderRadius: 999,
    backgroundColor: '#0f766e',
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  primaryActionText: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  secondaryAction: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  secondaryActionText: {
    fontWeight: '700',
  },
  iconAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionText: {
    fontSize: 16,
  },
  disabledAction: {
    opacity: 0.45,
  },
  dangerAction: {
    borderRadius: 999,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dangerActionText: {
    color: '#b91c1c',
    fontWeight: '800',
  },
  settingsSaveAction: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  settingsSaveActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  settingsList: {
    gap: 8,
  },
  settingsActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  settingsCompactAction: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  settingRow: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  settingInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontSize: 15,
  },
  collapsedTimerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    gap: 6,
  },
  timerSummary: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timerValue: {
    flexShrink: 0,
    fontSize: 30,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  timerValueButton: {
    flexShrink: 0,
  },
  timerControlsRail: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: 999,
  },
  timerControlSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  timerControlSegmentLeft: {
    borderRightWidth: 1,
  },
  timerControlSegmentRight: {
    borderLeftWidth: 1,
  },
  timerActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  collapsedChildSummary: {
    flex: 1,
    minWidth: 0,
  },
  childControlsRail: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: 23,
  },
  childSegment: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 10,
  },
  childActionSegment: {
    flexBasis: 0,
    flexGrow: 2,
    backgroundColor: '#d1dbe8',
    paddingHorizontal: 8,
  },
  childActionSegmentLeft: {
    backgroundColor: '#fee2e2',
    borderRightWidth: 1,
    borderRightColor: '#fbcfe8',
  },
  childActionSegmentRight: {
    backgroundColor: '#dcfce7',
    borderLeftWidth: 1,
    borderLeftColor: '#bbf7d0',
  },
  childActionText: {
    color: '#1e293b',
    fontSize: 22,
    fontWeight: '900',
  },
  childPointsSegment: {
    flexBasis: 0,
    flexGrow: 6,
    paddingHorizontal: 14,
  },
  childPointsValue: {
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  parentSection: {
    gap: 8,
  },
  parentToolsActions: {
    gap: 10,
  },
  archivedChildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  archivedChildCopy: {
    flex: 1,
    gap: 4,
  },
  archivedChildName: {
    fontSize: 17,
    fontWeight: '800',
  },
  archivedChildMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  archivedChildActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  archivedChildIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archivedChildIconButtonText: {
    fontSize: 18,
    fontWeight: '800',
  },
  archivedChildDeleteButton: {
    backgroundColor: '#fee2e2',
  },
  archivedChildDeleteButtonText: {
    fontSize: 18,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 24,
    gap: 14,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
  },
  modalInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
});
