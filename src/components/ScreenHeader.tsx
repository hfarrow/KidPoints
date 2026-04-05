import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppStorage } from '../features/app/appStorage';
import { useParentUnlockAction } from '../features/app/useParentUnlockAction';
import { useAppTheme, useThemedStyles } from '../features/theme/themeContext';
import { SettingsModal } from './SettingsModal';

type ScreenHeaderProps = {
  title: string;
  subtitle: string;
};

export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const { lockParent, parentSession } = useAppStorage();
  const { setThemeMode, themeMode } = useAppTheme();
  const { parentPinModal, requestParentUnlock } = useParentUnlockAction();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.controlsRow}>
        <Pressable
          accessibilityLabel={
            parentSession.isUnlocked ? 'Lock Parent Mode' : 'Unlock Parent Mode'
          }
          onPress={() => {
            if (parentSession.isUnlocked) {
              lockParent();
              return;
            }

            requestParentUnlock();
          }}
          style={[
            styles.modeButton,
            parentSession.isUnlocked
              ? styles.modeButtonActive
              : styles.modeButtonIdle,
          ]}
        >
          <Ionicons
            color={
              parentSession.isUnlocked
                ? styles.modeButtonIconActive.color
                : styles.modeButtonIconIdle.color
            }
            name={
              parentSession.isUnlocked
                ? 'lock-open-outline'
                : 'lock-closed-outline'
            }
            size={20}
          />
        </Pressable>
        <Pressable
          accessibilityLabel="Open settings"
          onPress={() => setSettingsVisible(true)}
          style={styles.iconButton}
        >
          <Ionicons
            color={styles.iconButtonText.color}
            name="settings-outline"
            size={18}
          />
        </Pressable>
      </View>
      {parentPinModal}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onSelectThemeMode={setThemeMode}
        themeMode={themeMode}
      />
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    header: {
      gap: 16,
    },
    copy: {
      gap: 6,
    },
    controlsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
    },
    title: {
      fontSize: 34,
      fontWeight: '900',
      color: tokens.textPrimary,
    },
    subtitle: {
      fontSize: 16,
      lineHeight: 24,
      color: tokens.textMuted,
    },
    modeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeButtonIdle: {
      backgroundColor: tokens.controlSurface,
    },
    modeButtonActive: {
      backgroundColor: tokens.controlSurfaceActive,
    },
    modeButtonIconIdle: {
      color: tokens.textPrimary,
    },
    modeButtonIconActive: {
      color: tokens.controlTextOnActive,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: tokens.controlSurface,
    },
    iconButtonText: {
      fontSize: 18,
      fontWeight: '800',
      color: tokens.controlText,
    },
  });
