import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useParentSession } from '../features/parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../features/theme/appTheme';
import { LoggedPressable } from './LoggedPressable';

type MainScreenActionsProps = {
  onPressSyncDevices?: () => void;
};

export function MainScreenActions({
  onPressSyncDevices,
}: MainScreenActionsProps) {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked, lockParentMode } = useParentSession();
  const { tokens } = useAppTheme();
  const handleOpenSyncDevices = () => {
    if (onPressSyncDevices) {
      onPressSyncDevices();
      return;
    }

    if (!isParentUnlocked) {
      router.navigate('/parent-unlock');
      return;
    }

    router.navigate('/sync');
  };

  return (
    <View style={styles.row}>
      <LoggedPressable
        accessibilityLabel="Open Settings"
        logLabel="Open Settings"
        onPress={() => router.navigate('/settings')}
        style={styles.action}
      >
        <Ionicons
          color={tokens.controlText}
          name="settings-outline"
          size={18}
        />
      </LoggedPressable>
      <LoggedPressable
        accessibilityLabel={
          isParentUnlocked
            ? 'Open Device Sync'
            : 'Unlock parent mode for device sync'
        }
        logLabel={
          isParentUnlocked
            ? 'Open Device Sync'
            : 'Unlock parent mode for device sync'
        }
        onPress={handleOpenSyncDevices}
        style={styles.action}
      >
        <Feather color={tokens.controlText} name="refresh-cw" size={18} />
      </LoggedPressable>
      <LoggedPressable
        accessibilityLabel={
          isParentUnlocked ? 'Lock Parent Mode' : 'Unlock Parent Mode'
        }
        logLabel={isParentUnlocked ? 'Lock Parent Mode' : 'Unlock Parent Mode'}
        onPress={() => {
          if (isParentUnlocked) {
            lockParentMode();
            return;
          }

          router.navigate('/parent-unlock');
        }}
        style={[
          styles.action,
          isParentUnlocked ? styles.parentUnlocked : styles.parentLocked,
        ]}
      >
        <Feather
          color={isParentUnlocked ? tokens.successText : tokens.controlText}
          name={isParentUnlocked ? 'unlock' : 'lock'}
          size={18}
        />
      </LoggedPressable>
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    action: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    parentLocked: {
      backgroundColor: tokens.floatingLabelSurface,
    },
    parentUnlocked: {
      backgroundColor: tokens.successSurface,
    },
  });
