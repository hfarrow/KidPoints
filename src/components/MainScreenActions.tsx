import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useParentSession } from '../features/parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../features/theme/themeContext';

export function MainScreenActions() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked, lockParentMode } = useParentSession();
  const { resolvedTheme, tokens } = useAppTheme();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel="Open Settings"
        onPress={() => router.push('/settings')}
        style={styles.action}
      >
        <Ionicons
          color={tokens.controlText}
          name="settings-outline"
          size={18}
        />
      </Pressable>
      <Pressable
        accessibilityLabel={
          isParentUnlocked ? 'Lock Parent Mode' : 'Unlock Parent Mode'
        }
        onPress={() => {
          if (isParentUnlocked) {
            lockParentMode();
            return;
          }

          router.push('/parent-unlock');
        }}
        style={[
          styles.action,
          isParentUnlocked ? styles.parentUnlocked : styles.parentLocked,
        ]}
      >
        <Feather
          color={
            isParentUnlocked
              ? resolvedTheme === 'dark'
                ? '#dcfce7'
                : '#14532d'
              : tokens.controlText
          }
          name={isParentUnlocked ? 'unlock' : 'lock'}
          size={18}
        />
      </Pressable>
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
