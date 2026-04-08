import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { LoggedPressable } from '../../components/LoggedPressable';
import { createModuleLogger } from '../../logging/logger';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';
import {
  normalizeParentPin,
  PARENT_PIN_LENGTH,
  validateParentPin,
} from './parentPin';
import { useParentSession } from './parentSessionContext';

const log = createModuleLogger('parent-unlock-modal');

type ParentModalMode = 'change' | 'setup' | 'unlock';
type ParentModalStage = 'confirm' | 'entry';

function resolveParentModalMode(
  value: string | string[] | undefined,
): ParentModalMode {
  const nextValue = Array.isArray(value) ? value[0] : value;

  if (nextValue === 'change' || nextValue === 'setup') {
    return nextValue;
  }

  return 'unlock';
}

export function ParentUnlockModal() {
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const parentPin = useLocalSettingsStore((state) => state.parentPin);
  const setParentPin = useLocalSettingsStore((state) => state.setParentPin);
  const { attemptUnlock, unlockParentMode } = useParentSession();
  const { tokens } = useAppTheme();
  const requestedMode = resolveParentModalMode(mode);
  const effectiveMode = parentPin ? requestedMode : 'setup';
  const canDismiss = effectiveMode !== 'setup';
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingPin, setPendingPin] = useState('');
  const [stage, setStage] = useState<ParentModalStage>('entry');

  useEffect(() => {
    log.debug('Parent unlock modal initialized', {
      canDismiss,
      mode: effectiveMode,
      stage,
    });
  }, [canDismiss, effectiveMode, stage]);

  useEffect(() => {
    log.debug('Parent unlock flow reset', {
      mode: effectiveMode,
    });
    setErrorMessage('');
    setPendingPin('');
    setPin('');
    setStage('entry');
  }, [effectiveMode]);

  useEffect(() => {
    if (canDismiss) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );

    return () => {
      subscription.remove();
    };
  }, [canDismiss]);

  const resetPinSetup = (nextErrorMessage = '') => {
    setErrorMessage(nextErrorMessage);
    setPendingPin('');
    setPin('');
    setStage('entry');
  };

  const moveToPinConfirmation = (value: string) => {
    const validationError = validateParentPin(value);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage('');
    setPendingPin(value);
    setPin('');
    setStage('confirm');
  };

  const submitPin = (value: string) => {
    if (effectiveMode === 'unlock') {
      const didUnlock = attemptUnlock(value);

      if (!didUnlock) {
        setErrorMessage(
          'That PIN does not match the parent PIN for this device.',
        );
        return;
      }

      router.back();
      return;
    }

    if (stage === 'entry') {
      moveToPinConfirmation(value);
      return;
    }

    const validationError = validateParentPin(value);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (value !== pendingPin) {
      resetPinSetup('Those PINs did not match. Enter a new PIN to try again.');
      return;
    }

    setParentPin(value);
    unlockParentMode();
    router.back();
  };

  const copy =
    effectiveMode === 'unlock'
      ? {
          accessibilityLabel: 'Parent PIN',
          body: 'Enter the parent PIN for this device to unlock parent-gated controls.',
          confirmLabel: 'Unlock',
          title: 'Unlock Parent Controls',
        }
      : stage === 'confirm'
        ? {
            accessibilityLabel:
              effectiveMode === 'change'
                ? 'Confirm New Parent PIN'
                : 'Confirm Parent PIN',
            body: `Enter the same ${PARENT_PIN_LENGTH}-digit PIN again to confirm it.`,
            confirmLabel: effectiveMode === 'change' ? 'Save PIN' : 'Save PIN',
            title:
              effectiveMode === 'change'
                ? 'Confirm New Parent PIN'
                : 'Confirm Parent PIN',
          }
        : {
            accessibilityLabel:
              effectiveMode === 'change'
                ? 'New Parent PIN'
                : 'Create Parent PIN',
            body:
              effectiveMode === 'change'
                ? `Set a new ${PARENT_PIN_LENGTH}-digit PIN for this device. You will confirm it on the next step.`
                : `Create a ${PARENT_PIN_LENGTH}-digit PIN for this device. You will confirm it on the next step before Parent Mode can be used.`,
            confirmLabel: 'Continue',
            title:
              effectiveMode === 'change'
                ? 'Change Parent PIN'
                : 'Set Parent PIN',
          };

  return (
    <KeyboardAvoidingView
      behavior="height"
      style={[styles.backdrop, { backgroundColor: tokens.modalBackdrop }]}
      testID="parent-unlock-keyboard-frame"
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Parent Mode</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        <TextInput
          accessibilityLabel={copy.accessibilityLabel}
          autoFocus
          keyboardType="number-pad"
          onChangeText={(nextValue) => {
            const normalizedValue = normalizeParentPin(nextValue);

            setPin(normalizedValue);
            if (errorMessage) {
              setErrorMessage('');
            }

            if (
              effectiveMode === 'unlock' &&
              normalizedValue.length === PARENT_PIN_LENGTH &&
              attemptUnlock(normalizedValue)
            ) {
              router.back();
            }
          }}
          placeholder="0000"
          placeholderTextColor={tokens.textMuted}
          secureTextEntry
          style={styles.input}
          value={pin}
          maxLength={PARENT_PIN_LENGTH}
        />
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <View style={styles.actions}>
          {canDismiss ? (
            <LoggedPressable
              logLabel="Cancel Parent Unlock"
              onPress={() => router.back()}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </LoggedPressable>
          ) : null}
          <LoggedPressable
            logLabel={copy.confirmLabel}
            onPress={() => submitPin(pin)}
            style={styles.primaryAction}
          >
            <Text style={styles.primaryText}>{copy.confirmLabel}</Text>
          </LoggedPressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    backdrop: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 18,
    },
    card: {
      backgroundColor: tokens.modalSurface,
      borderColor: tokens.border,
      borderRadius: 24,
      borderWidth: 1,
      flexShrink: 1,
      gap: 10,
      maxHeight: '100%',
      maxWidth: 420,
      paddingHorizontal: 18,
      paddingVertical: 18,
      width: '100%',
    },
    eyebrow: {
      color: tokens.accent,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    title: {
      color: tokens.textPrimary,
      fontSize: 24,
      fontWeight: '900',
    },
    body: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    input: {
      backgroundColor: tokens.inputSurface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      color: tokens.textPrimary,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 4,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    error: {
      color: tokens.critical,
      fontSize: 13,
      fontWeight: '700',
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'flex-end',
      marginTop: 4,
    },
    secondaryAction: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 999,
      justifyContent: 'center',
      minHeight: 38,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    primaryAction: {
      alignItems: 'center',
      backgroundColor: tokens.accent,
      borderRadius: 999,
      justifyContent: 'center',
      minHeight: 38,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    secondaryText: {
      color: tokens.controlText,
      fontSize: 14,
      fontWeight: '800',
    },
    primaryText: {
      color: '#f8fafc',
      fontSize: 14,
      fontWeight: '800',
    },
  });
