import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Tile } from '../../components/Tile';
import { useAppTheme } from '../theme/themeContext';

type ChildSettingsTileProps = {
  childDisplayName: string;
  childIndex: number;
  childNameValue: string;
  isLastChild: boolean;
  onArchiveChild: () => void;
  onChangeName: (value: string) => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onNameBlur: () => void;
  onSave: () => void;
};

export function ChildSettingsTile({
  childDisplayName,
  childIndex,
  childNameValue,
  isLastChild,
  onArchiveChild,
  onChangeName,
  onMoveDown,
  onMoveUp,
  onNameBlur,
  onSave,
}: ChildSettingsTileProps) {
  const { tokens } = useAppTheme();

  return (
    <Tile
      collapsible={false}
      floatingTitle
      summaryVisibleWhenExpanded
      title={`${childDisplayName} Settings`}
    >
      <View style={styles.settingsList}>
        <View style={styles.settingsActionRow}>
          <Pressable
            accessibilityLabel={`Save ${childDisplayName} settings`}
            onPress={onSave}
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
            disabled={childIndex === 0}
            onPress={onMoveUp}
            style={[
              styles.secondaryAction,
              styles.settingsCompactAction,
              { backgroundColor: tokens.controlSurface },
              childIndex === 0 && styles.disabledAction,
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
            disabled={isLastChild}
            onPress={onMoveDown}
            style={[
              styles.secondaryAction,
              styles.settingsCompactAction,
              { backgroundColor: tokens.controlSurface },
              isLastChild && styles.disabledAction,
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
        <View style={[styles.settingRow, { borderColor: tokens.border }]}>
          <Text style={[styles.settingLabel, { color: tokens.textPrimary }]}>
            Name:
          </Text>
          <TextInput
            accessibilityLabel={`Child name for ${childDisplayName}`}
            onBlur={onNameBlur}
            onChangeText={onChangeName}
            placeholder="Child name"
            placeholderTextColor={tokens.textMuted}
            style={[
              styles.settingInput,
              {
                backgroundColor: tokens.inputSurface,
                color: tokens.textPrimary,
              },
            ]}
            value={childNameValue}
          />
        </View>
        <Pressable onPress={onArchiveChild} style={styles.dangerAction}>
          <Text style={styles.dangerActionText}>Archive child</Text>
        </Pressable>
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
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
  secondaryAction: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  secondaryActionText: {
    fontWeight: '700',
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
});
