import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { LoggedPressable } from '../../components/LoggedPressable';
import { ScreenBackFooter } from '../../components/ScreenBackFooter';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { SingleSelectList } from '../../components/SingleSelectList';
import {
  ActionPill,
  ActionPillRow,
  SectionLabel,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import {
  createModuleLogger,
  getSelectableAppLogLevels,
} from '../../logging/logger';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import type { ThemeDefinition, ThemeMode } from '../theme/theme';

const THEME_OPTIONS: ThemeMode[] = ['light', 'dark', 'system'];
const log = createModuleLogger('settings-screen');

function getThemeDescription(theme: ThemeDefinition) {
  if (theme.id === 'gruvbox') {
    return 'Retro warm neutrals with classic Gruvbox contrast.';
  }

  return 'Playful violet and berry-blue accents.';
}

export function SettingsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const [isThemeListVisible, setThemeListVisible] = useState(false);
  const { isParentUnlocked, lockParentMode } = useParentSession();
  const {
    activeTheme,
    activeThemeId,
    availableThemes,
    resolvedTheme,
    setActiveThemeId,
    setThemeMode,
    themeMode,
    tokens,
  } = useAppTheme();
  const parentPin = useLocalSettingsStore((state) => state.parentPin);
  const hapticsEnabled = useLocalSettingsStore((state) => state.hapticsEnabled);
  const logLevel = useLocalSettingsStore((state) => state.logLevel);
  const setHapticsEnabled = useLocalSettingsStore(
    (state) => state.setHapticsEnabled,
  );
  const setLogLevel = useLocalSettingsStore((state) => state.setLogLevel);
  const selectableAppLogLevels = getSelectableAppLogLevels();

  useEffect(() => {
    log.debug('Settings screen initialized');
  }, []);

  return (
    <ScreenScaffold footer={<ScreenBackFooter />}>
      <ScreenHeader title="Settings" />

      <Tile accessory={<StatusBadge label={resolvedTheme} />} title="Theme">
        <View style={styles.themeSection}>
          <SectionLabel>Theme Family</SectionLabel>
          <LoggedPressable
            accessibilityLabel={
              isThemeListVisible
                ? 'Close theme family picker'
                : 'Open theme family picker'
            }
            accessibilityRole="button"
            logContext={{
              activeThemeId,
              isThemeListVisible,
            }}
            logLabel={
              isThemeListVisible
                ? 'Close theme family picker'
                : 'Open theme family picker'
            }
            onPress={() => setThemeListVisible(true)}
            style={[
              styles.themeMenuTrigger,
              isThemeListVisible && {
                backgroundColor: tokens.accentSoft,
                borderColor: tokens.accent,
              },
            ]}
          >
            <View style={styles.themeMenuTriggerCopy}>
              <Text style={styles.themeMenuTriggerLabel}>
                {activeTheme.label}
              </Text>
              <Text style={styles.themeMenuTriggerHelper}>
                Choose the app color family.
              </Text>
            </View>
            <Feather
              color={tokens.controlText}
              name="chevron-right"
              size={18}
            />
          </LoggedPressable>
        </View>

        <View style={styles.themeSection}>
          <SectionLabel>Appearance Mode</SectionLabel>
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
                  logLabel={`Set theme mode to ${option}`}
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
        </View>
      </Tile>
      <SingleSelectList
        closeLabel="Done"
        getItemDescription={(theme) => getThemeDescription(theme)}
        getItemLabel={(theme) => theme.label}
        items={[...availableThemes]}
        keyExtractor={(theme) => theme.id}
        onRequestClose={() => setThemeListVisible(false)}
        onSelect={(theme) => {
          setActiveThemeId(theme.id);
          setThemeListVisible(false);
        }}
        selectedItemId={activeThemeId}
        subtitle="Choose the app color family. Appearance mode still controls light, dark, or system behavior."
        title="Theme Family"
        visible={isThemeListVisible}
      />

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

      <Tile
        accessory={<StatusBadge label={hapticsEnabled ? 'On' : 'Off'} />}
        title="Touch Feedback"
      >
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleLabel}>Haptics</Text>
            <Text style={styles.toggleHelper}>
              Add light vibration feedback to supported button taps across the
              app.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Enable haptics"
            onValueChange={setHapticsEnabled}
            thumbColor="#f8fafc"
            trackColor={{
              false: tokens.controlTrackOff,
              true: tokens.accent,
            }}
            value={hapticsEnabled}
          />
        </View>
      </Tile>

      <Tile accessory={<StatusBadge label={logLevel} />} title="Debug">
        <Text style={styles.body}>
          Choose the active app log level. This setting stays available in
          release builds so we can raise or reduce logging without a rebuild.
        </Text>
        <View style={styles.logLevelOptionRow}>
          {selectableAppLogLevels.map((option) => {
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
        <ActionPillRow>
          <ActionPill
            label="View Logs"
            onPress={() => router.push('/logs')}
            tone="primary"
          />
        </ActionPillRow>
      </Tile>
    </ScreenScaffold>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    body: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    themeMenuTrigger: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      minHeight: 56,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    themeMenuTriggerCopy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    themeMenuTriggerHelper: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    themeMenuTriggerLabel: {
      color: tokens.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    themeSection: {
      gap: 8,
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
    toggleCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    toggleHelper: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    toggleLabel: {
      color: tokens.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    toggleRow: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
  });
