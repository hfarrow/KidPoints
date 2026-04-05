import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ThemeMode } from '../features/app/types';
import {
  type useAppTheme,
  useThemedStyles,
} from '../features/theme/themeContext';

type SettingsModalProps = {
  onClose: () => void;
  onSelectThemeMode: (mode: ThemeMode) => void;
  themeMode: ThemeMode;
  visible: boolean;
};

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

export function SettingsModal({
  onClose,
  onSelectThemeMode,
  themeMode,
  visible,
}: SettingsModalProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Theme</Text>
            <Text style={styles.sectionBody}>
              Choose the appearance for KidPoints across the shared app shell.
            </Text>
            <View style={styles.segmentedControl}>
              {THEME_OPTIONS.map((option) => {
                const isSelected = themeMode === option.value;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityLabel={`Use ${option.label} theme`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => onSelectThemeMode(option.value)}
                    style={[
                      styles.segmentOption,
                      isSelected
                        ? styles.segmentOptionSelected
                        : styles.segmentOptionIdle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentOptionText,
                        isSelected
                          ? styles.segmentOptionTextSelected
                          : styles.segmentOptionTextIdle,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: tokens.modalBackdrop,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 24,
      padding: 24,
      gap: 18,
      backgroundColor: tokens.modalSurface,
    },
    title: {
      fontSize: 24,
      fontWeight: '900',
      color: tokens.textPrimary,
    },
    section: {
      gap: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.textPrimary,
    },
    sectionBody: {
      fontSize: 15,
      lineHeight: 22,
      color: tokens.textMuted,
    },
    segmentedControl: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      borderRadius: 18,
      padding: 8,
      backgroundColor: tokens.segmentedControlSurface,
    },
    segmentOption: {
      flexGrow: 1,
      minWidth: 84,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    segmentOptionIdle: {
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
    },
    segmentOptionSelected: {
      backgroundColor: tokens.controlSurfaceActive,
      borderColor: tokens.border,
    },
    segmentOptionText: {
      fontSize: 14,
      fontWeight: '800',
    },
    segmentOptionTextIdle: {
      color: tokens.controlText,
    },
    segmentOptionTextSelected: {
      color: tokens.controlTextOnActive,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    closeButton: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 18,
      paddingVertical: 10,
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
    },
    closeButtonText: {
      fontWeight: '800',
      color: tokens.controlText,
    },
  });
