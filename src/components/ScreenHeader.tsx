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
          <Text
            style={[
              styles.modeButtonText,
              parentSession.isUnlocked
                ? styles.modeButtonTextActive
                : styles.modeButtonTextIdle,
            ]}
          >
            {parentSession.isUnlocked
              ? 'Lock Parent Mode'
              : 'Unlock Parent Mode'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Open settings"
          onPress={() => setSettingsVisible(true)}
          style={styles.iconButton}
        >
          <Text style={styles.iconButtonText}>{'\u2699'}</Text>
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
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 18,
      paddingVertical: 11,
    },
    modeButtonIdle: {
      backgroundColor: tokens.controlSurface,
    },
    modeButtonActive: {
      backgroundColor: tokens.controlSurfaceActive,
    },
    modeButtonText: {
      fontSize: 14,
      fontWeight: '800',
    },
    modeButtonTextIdle: {
      color: tokens.textPrimary,
    },
    modeButtonTextActive: {
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
