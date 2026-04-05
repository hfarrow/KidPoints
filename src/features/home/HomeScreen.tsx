import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
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
import { AlarmTile } from '../alarm/AlarmTile';
import { useAppStorage } from '../app/appStorage';
import { useParentUnlockAction } from '../app/useParentUnlockAction';
import { useAppTheme } from '../theme/themeContext';
import { ChildSettingsTile } from './ChildSettingsTile';
import { ChildSummaryTile } from './ChildSummaryTile';
import { EmptyChildrenTile } from './EmptyChildrenTile';
import { ParentToolsTile } from './ParentToolsTile';

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
      <ScrollView
        contentContainerStyle={[styles.content, tokens.layout.tabScreenContent]}
      >
        <ScreenHeader title="Home" />

        <AlarmTile
          headerAccessory={
            isParentUnlocked ? (
              <Pressable
                accessibilityLabel="Open alarm settings panel"
                onPress={() => router.push('/alarm')}
                style={[
                  styles.iconAction,
                  { backgroundColor: tokens.controlSurface },
                ]}
              >
                <Ionicons
                  color={tokens.controlText}
                  name="settings-outline"
                  size={18}
                />
              </Pressable>
            ) : null
          }
          isParentUnlocked={isParentUnlocked}
          onLockedPress={() => requestParentUnlock()}
          onPause={pauseTimer}
          onReset={resetTimer}
          onStart={startTimer}
          remainingMs={timerSnapshot.remainingMs}
          running={timerSnapshot.isRunning}
        />

        {children.length === 0 ? (
          <EmptyChildrenTile
            isParentUnlocked={isParentUnlocked}
            onAddChild={() => setAddModalVisible(true)}
          />
        ) : null}

        {children.map((child, index) => {
          const isEditingSettings = childSettingsEditor?.childId === child.id;

          if (isEditingSettings) {
            return (
              <ChildSettingsTile
                key={child.id}
                childDisplayName={child.displayName}
                childIndex={index}
                childNameValue={childSettingsEditor.value}
                isLastChild={index === children.length - 1}
                onArchiveChild={() =>
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
                onChangeName={(value) =>
                  setChildSettingsEditor((current) =>
                    current
                      ? {
                          ...current,
                          value,
                        }
                      : null,
                  )
                }
                onMoveDown={() => moveChild(child.id, 'down')}
                onMoveUp={() => moveChild(child.id, 'up')}
                onNameBlur={() =>
                  saveChildSettingsName({
                    childId: child.id,
                    currentName: child.displayName,
                    nextName: childSettingsEditor.value,
                  })
                }
                onSave={() => {
                  saveChildSettingsName({
                    childId: child.id,
                    currentName: child.displayName,
                    nextName: childSettingsEditor.value,
                  });
                  setChildSettingsEditor(null);
                }}
              />
            );
          }

          return (
            <ChildSummaryTile
              key={child.id}
              childDisplayName={child.displayName}
              childId={child.id}
              isParentUnlocked={isParentUnlocked}
              onDecrementPoints={decrementPoints}
              onEditPoints={(childId) => {
                if (!isParentUnlocked) {
                  requestParentUnlock();
                  return;
                }

                setPointEditor({
                  childId,
                  displayName: child.displayName,
                  value: String(child.points),
                });
              }}
              onIncrementPoints={incrementPoints}
              onOpenSettings={(childId, displayName) =>
                setChildSettingsEditor({
                  childId,
                  value: displayName,
                })
              }
              points={child.points}
            />
          );
        })}

        {isParentUnlocked ? (
          <ParentToolsTile
            archivedChildrenCount={archivedChildren.length}
            onAddChild={() => setAddModalVisible(true)}
            onShowArchivedChildren={() => setArchivedChildrenVisible(true)}
            onShowTransactions={() => router.push('/transactions')}
          />
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
                <MaterialIcons
                  color={tokens.controlText}
                  name="restore"
                  size={20}
                />
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
                <Feather color="#b91c1c" name="trash-2" size={18} />
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
  content: {},
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
  archivedChildDeleteButton: {
    backgroundColor: '#fee2e2',
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
