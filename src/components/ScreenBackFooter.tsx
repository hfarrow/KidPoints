import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useAppTheme, useThemedStyles } from '../features/theme/appTheme';
import { LoggedPressable } from './LoggedPressable';

type ScreenBackFooterProps = {
  disableLogging?: boolean;
  label?: string;
};

export function ScreenBackFooter({
  disableLogging = false,
  label = 'Back',
}: ScreenBackFooterProps) {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();

  return (
    <LoggedPressable
      accessibilityLabel="Go Back"
      disableLogging={disableLogging}
      logLabel="Go Back"
      onPress={() => router.back()}
      style={styles.button}
    >
      <Feather color={tokens.controlText} name="arrow-left" size={18} />
      <Text style={styles.label}>{label}</Text>
    </LoggedPressable>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    button: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: 16,
      width: '100%',
    },
    label: {
      color: tokens.controlText,
      fontSize: 16,
      fontWeight: '800',
    },
  });
