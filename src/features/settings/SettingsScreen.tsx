import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LoggedPressable } from '../../components/LoggedPressable';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  ActionPillRow,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { APP_LOG_LEVELS, createModuleLogger } from '../../logging/logger';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import { useParentSession } from '../parent/parentSessionContext';
import type { ThemeMode } from '../theme/theme';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';

const THEME_OPTIONS: ThemeMode[] = ['light', 'dark', 'system'];
const log = createModuleLogger('settings-screen');

export function SettingsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked, lockParentMode } = useParentSession();
  const { resolvedTheme, setThemeMode, themeMode, tokens } = useAppTheme();
  const parentPin = useLocalSettingsStore((state) => state.parentPin);
  const logLevel = useLocalSettingsStore((state) => state.logLevel);
  const setLogLevel = useLocalSettingsStore((state) => state.setLogLevel);

  useEffect(() => {
    log.debug('Settings screen initialized');
  }, []);

  return (
    <ScreenScaffold>
      <ScreenHeader
        leadingAction={
          <LoggedPressable
            accessibilityLabel="Go Back"
            logLabel="Go Back"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Feather color={tokens.controlText} name="arrow-left" size={18} />
          </LoggedPressable>
        }
        title="Settings"
      />

      <Tile accessory={<StatusBadge label={resolvedTheme} />} title="Theme">
        <View style={styles.optionRow}>
          {THEME_OPTIONS.map((option) => {
            const isActive = themeMode === option;

            return (
              <LoggedPressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                logContext={{
                  selected: isActive,
                  themeMode: option,
                }}
                logLabel={`Set theme to ${option}`}
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
              </LoggedPressable>
            );
          })}
        </View>
      </Tile>

      <Tile
        accessory={
          <StatusBadge
            label={
              !parentPin
                ? 'Setup Required'
                : isParentUnlocked
                  ? 'Unlocked'
                  : 'Locked'
            }
            tone={parentPin && isParentUnlocked ? 'good' : 'warning'}
          />
        }
        title="Parent Session"
      >
        <Text style={styles.body}>
          Parent Mode stays local to this device. Use the parent PIN to unlock
          protected controls, and change it here whenever you need to.
        </Text>
        <ActionPillRow>
          <ActionPill
            label={
              !parentPin ? 'Set PIN' : isParentUnlocked ? 'Lock' : 'Unlock'
            }
            onPress={() => {
              if (!parentPin) {
                router.push('/parent-unlock?mode=setup');
                return;
              }

              if (isParentUnlocked) {
                lockParentMode();
                return;
              }

              router.push('/parent-unlock');
            }}
            tone="primary"
          />
          {parentPin && isParentUnlocked ? (
            <ActionPill
              label="Change PIN"
              onPress={() => router.push('/parent-unlock?mode=change')}
            />
          ) : null}
        </ActionPillRow>
      </Tile>

      <Tile accessory={<StatusBadge label={logLevel} />} title="Debug">
        <Text style={styles.body}>
          Choose the active app log level. This setting stays available in
          release builds so we can raise or reduce logging without a rebuild.
        </Text>
        <View style={styles.logLevelOptionRow}>
          {APP_LOG_LEVELS.map((option) => {
            const isActive = logLevel === option;

            return (
              <LoggedPressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                logContext={{
                  logLevel: option,
                  selected: isActive,
                }}
                logLabel={`Set log level to ${option}`}
                onPress={() => setLogLevel(option)}
                style={[
                  styles.option,
                  styles.logLevelOption,
                  isActive && {
                    backgroundColor: tokens.accentSoft,
                    borderColor: tokens.accent,
                  },
                ]}
              >
                <Text style={styles.optionTitle}>{option}</Text>
              </LoggedPressable>
            );
          })}
        </View>
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
      flexDirection: 'row',
      gap: 8,
    },
    logLevelOption: {
      flexBasis: '48%',
      flexGrow: 1,
    },
    logLevelOptionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    option: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    optionTitle: {
      color: tokens.textPrimary,
      fontSize: 14,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
  });
