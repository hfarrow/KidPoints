import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  ActionPillRow,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { useShellSession } from '../shell/shellContext';
import type { ThemeMode } from '../theme/theme';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';

const THEME_OPTIONS: ThemeMode[] = ['light', 'dark', 'system'];

export function SettingsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked } = useShellSession();
  const { resolvedTheme, setThemeMode, themeMode, tokens } = useAppTheme();

  return (
    <ScreenScaffold>
      <ScreenHeader
        leadingAction={
          <Pressable
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Feather color={tokens.controlText} name="arrow-left" size={18} />
          </Pressable>
        }
        title="Settings"
      />

      <Tile
        accessory={<StatusBadge label={resolvedTheme} />}
        title="Display mode"
      >
        <View style={styles.optionRow}>
          {THEME_OPTIONS.map((option) => {
            const isActive = themeMode === option;

            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => setThemeMode(option)}
                style={[
                  styles.option,
                  isActive && {
                    backgroundColor: tokens.accentSoft,
                    borderColor: tokens.accent,
                  },
                ]}
              >
                <Text style={styles.optionTitle}>{option}</Text>
                <Text style={styles.optionBody}>
                  {option === 'system'
                    ? 'Follow device appearance.'
                    : `Use ${option} tokens immediately.`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Tile>

      <Tile
        accessory={
          <StatusBadge
            label={isParentUnlocked ? 'Unlocked' : 'Locked'}
            tone={isParentUnlocked ? 'good' : 'warning'}
          />
        }
        title="Shell session"
      >
        <Text style={styles.body}>
          Parent Mode stays local to this device for now, uses the hardcoded PIN
          `0000`, and defaults to unlocked in development.
        </Text>
        <ActionPillRow>
          <ActionPill
            label="Open unlock"
            onPress={() => router.push('/parent-unlock')}
            tone="primary"
          />
          <ActionPill
            label="Archived children"
            onPress={() => router.push('/list-browser')}
          />
        </ActionPillRow>
      </Tile>
    </ScreenScaffold>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    backButton: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    body: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    optionRow: {
      gap: 8,
    },
    option: {
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: 2,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    optionTitle: {
      color: tokens.textPrimary,
      fontSize: 15,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    optionBody: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });
