import { StyleSheet, Text, View } from 'react-native';

import { LoggedPressable } from '../../components/LoggedPressable';
import { type useAppTheme, useThemedStyles } from '../theme/appTheme';

type TimerControlRailProps = {
  contextLabel: string;
  onPause: () => void;
  onReset: () => void;
  onStart: () => void;
  pauseDisabled: boolean;
  resetDisabled: boolean;
  startDisabled: boolean;
};

type TimerRailButtonProps = {
  accessibilityLabel: string;
  disabled: boolean;
  isLast?: boolean;
  label: string;
  logLabel: string;
  onPress: () => void;
};

function TimerRailButton({
  accessibilityLabel,
  disabled,
  isLast = false,
  label,
  logLabel,
  onPress,
}: TimerRailButtonProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <LoggedPressable
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      logContext={{ disabled }}
      logLabel={logLabel}
      onPress={onPress}
      style={[
        styles.button,
        !isLast && styles.buttonBorder,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
        {label}
      </Text>
    </LoggedPressable>
  );
}

export function TimerControlRail({
  contextLabel,
  onPause,
  onReset,
  onStart,
  pauseDisabled,
  resetDisabled,
  startDisabled,
}: TimerControlRailProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.rail}>
      <TimerRailButton
        accessibilityLabel={`${contextLabel} start timer`}
        disabled={startDisabled}
        label="Start"
        logLabel={`${contextLabel} start timer`}
        onPress={onStart}
      />
      <TimerRailButton
        accessibilityLabel={`${contextLabel} pause timer`}
        disabled={pauseDisabled}
        label="Pause"
        logLabel={`${contextLabel} pause timer`}
        onPress={onPause}
      />
      <TimerRailButton
        accessibilityLabel={`${contextLabel} reset timer`}
        disabled={resetDisabled}
        isLast
        label="Reset"
        logLabel={`${contextLabel} reset timer`}
        onPress={onReset}
      />
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    rail: {
      backgroundColor: tokens.controlSurface,
      borderRadius: 999,
      flexDirection: 'row',
      minHeight: 40,
      overflow: 'hidden',
    },
    button: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      minWidth: 0,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    buttonBorder: {
      borderRightColor: tokens.border,
      borderRightWidth: 1,
    },
    buttonDisabled: {
      opacity: 0.45,
    },
    buttonText: {
      color: tokens.controlText,
      fontSize: 13,
      fontWeight: '800',
    },
    buttonTextDisabled: {
      color: tokens.textMuted,
    },
  });
