import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, TextInput, View } from 'react-native';

import { KeyboardModalFrame } from '../../components/KeyboardModalFrame';
import { LoggedPressable } from '../../components/LoggedPressable';
import { createModuleLogger } from '../../logging/logger';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import { scheduleAfterFrameCommit } from '../../timing/scheduleAfterFrameCommit';
import {
  triggerErrorHaptic,
  triggerLightImpactHaptic,
} from '../haptics/appHaptics';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import {
  normalizeParentPin,
  PARENT_PIN_LENGTH,
  validateParentPin,
} from './parentPin';
import { useParentSession } from './parentSessionContext';

const log = createModuleLogger('parent-unlock-modal');
const PIN_SLOT_KEYS = ['pin-slot-0', 'pin-slot-1', 'pin-slot-2', 'pin-slot-3'];
const PIN_REVEAL_DURATION_MS = 700;
const UNLOCK_ERROR_DELAY_MS = 900;
const UNLOCK_SUCCESS_DELAY_MS = 300;
const BODY_LINE_HEIGHT = 20;
const UNLOCK_BODY_MIN_LINES = 3;

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
  const hapticsEnabled = useLocalSettingsStore((state) => state.hapticsEnabled);
  const parentPin = useLocalSettingsStore((state) => state.parentPin);
  const setParentPin = useLocalSettingsStore((state) => state.setParentPin);
  const { attemptUnlock, unlockParentMode } = useParentSession();
  const { tokens } = useAppTheme();
  const requestedMode = resolveParentModalMode(mode);
  const effectiveMode = parentPin ? requestedMode : 'setup';
  const canDismiss = effectiveMode !== 'setup';
  const pinInputRef = useRef<TextInput>(null);
  const unlockFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPinInputFocused, setIsPinInputFocused] = useState(false);
  const [isUnlockErrorPending, setIsUnlockErrorPending] = useState(false);
  const [isUnlockSuccessPending, setIsUnlockSuccessPending] = useState(false);
  const [pendingPin, setPendingPin] = useState('');
  const [revealedDigitIndex, setRevealedDigitIndex] = useState<number | null>(
    null,
  );
  const [stage, setStage] = useState<ParentModalStage>('entry');

  useEffect(() => {
    log.debug('Parent unlock modal initialized', {
      canDismiss,
      mode: effectiveMode,
      stage,
    });
  }, [canDismiss, effectiveMode, stage]);

  useEffect(() => {
    if (unlockFeedbackTimeoutRef.current) {
      clearTimeout(unlockFeedbackTimeoutRef.current);
      unlockFeedbackTimeoutRef.current = null;
    }

    log.debug('Parent unlock flow reset', {
      mode: effectiveMode,
    });
    setErrorMessage('');
    setIsUnlockErrorPending(false);
    setIsUnlockSuccessPending(false);
    setPendingPin('');
    setPin('');
    setRevealedDigitIndex(null);
    setStage('entry');
  }, [effectiveMode]);

  useEffect(() => {
    return () => {
      if (unlockFeedbackTimeoutRef.current) {
        clearTimeout(unlockFeedbackTimeoutRef.current);
      }
    };
  }, []);

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
    setIsUnlockErrorPending(false);
    setIsUnlockSuccessPending(false);
    setPendingPin('');
    setPin('');
    setRevealedDigitIndex(null);
    setStage('entry');
  };

  useEffect(() => {
    if (revealedDigitIndex === null || !pin[revealedDigitIndex]) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setRevealedDigitIndex((currentValue) =>
        currentValue === revealedDigitIndex ? null : currentValue,
      );
    }, PIN_REVEAL_DURATION_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [pin, revealedDigitIndex]);

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

  const closeModal = () => {
    if (unlockFeedbackTimeoutRef.current) {
      clearTimeout(unlockFeedbackTimeoutRef.current);
      unlockFeedbackTimeoutRef.current = null;
    }

    router.back();
  };

  const beginSuccessfulUnlockFeedback = () => {
    setErrorMessage('');
    setIsUnlockErrorPending(false);
    setIsUnlockSuccessPending(true);
    unlockFeedbackTimeoutRef.current = setTimeout(() => {
      unlockFeedbackTimeoutRef.current = null;
      closeModal();
    }, UNLOCK_SUCCESS_DELAY_MS);
  };

  const beginFailedUnlockFeedback = () => {
    triggerErrorHaptic(hapticsEnabled);
    setErrorMessage('That PIN does not match the parent PIN for this device.');
    setIsUnlockErrorPending(true);
    setIsUnlockSuccessPending(false);
    unlockFeedbackTimeoutRef.current = setTimeout(() => {
      unlockFeedbackTimeoutRef.current = null;
      setIsUnlockErrorPending(false);
      setIsPinInputFocused(true);
      setPin('');
      setRevealedDigitIndex(null);
    }, UNLOCK_ERROR_DELAY_MS);
  };

  const submitPin = (value: string) => {
    if (effectiveMode === 'unlock') {
      if (isUnlockErrorPending || isUnlockSuccessPending) {
        return;
      }

      const didUnlock = attemptUnlock(value);

      if (!didUnlock) {
        beginFailedUnlockFeedback();
        return;
      }

      beginSuccessfulUnlockFeedback();
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
    closeModal();
  };

  const handlePinChange = (nextValue: string) => {
    if (isUnlockErrorPending || isUnlockSuccessPending) {
      return;
    }

    const normalizedValue = normalizeParentPin(nextValue);
    const isDigitAdded = normalizedValue.length > pin.length;

    setPin(normalizedValue);
    if (isDigitAdded) {
      triggerLightImpactHaptic(hapticsEnabled);
      setRevealedDigitIndex(normalizedValue.length - 1);
    } else {
      setRevealedDigitIndex(null);
    }
    if (errorMessage) {
      setErrorMessage('');
    }

    if (
      effectiveMode === 'unlock' &&
      normalizedValue.length === PARENT_PIN_LENGTH
    ) {
      const didUnlock = attemptUnlock(normalizedValue);

      if (didUnlock) {
        beginSuccessfulUnlockFeedback();
      } else {
        beginFailedUnlockFeedback();
      }
    }
  };

  const copy =
    effectiveMode === 'unlock'
      ? {
          accessibilityLabel: 'Parent PIN',
          body: 'Enter the parent PIN for this device to unlock parent-gated controls.',
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
  const isUnlockFeedbackPending =
    isUnlockErrorPending || isUnlockSuccessPending;
  const actionConfirmLabel =
    effectiveMode === 'unlock' ? null : copy.confirmLabel;
  const bodyMessage =
    effectiveMode === 'unlock' && errorMessage ? errorMessage : copy.body;
  const bodyStyle =
    effectiveMode === 'unlock'
      ? [styles.body, styles.unlockBody, errorMessage && styles.bodyError]
      : [styles.body, errorMessage && styles.bodyError];
  const pinInputFocusKey = `${effectiveMode}:${stage}`;

  useEffect(() => {
    if (!pinInputFocusKey) {
      return;
    }

    return scheduleAfterFrameCommit(() => {
      pinInputRef.current?.focus();
    });
  }, [pinInputFocusKey]);

  return (
    <KeyboardModalFrame
      contentTestID="parent-unlock-keyboard-content"
      hideUntilKeyboardPositioned={false}
      initialVerticalPosition="bottom"
      style={{ backgroundColor: tokens.modalBackdrop }}
      testID="parent-unlock-keyboard-frame"
    >
      <View style={styles.card} testID="parent-unlock-card">
        <Text style={styles.eyebrow}>Parent Mode</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={bodyStyle}>{bodyMessage}</Text>
        <View style={styles.pinEntry}>
          <View pointerEvents="none" style={styles.pinRow}>
            {PIN_SLOT_KEYS.map((slotKey, index) => {
              const digit = pin[index] ?? '';
              const isFilled = Boolean(digit);
              const shouldRevealDigit =
                isFilled && revealedDigitIndex === index;
              const isErrorState = isUnlockErrorPending && isFilled;
              const isSuccessState = isUnlockSuccessPending && isFilled;
              const isActive =
                !isUnlockFeedbackPending &&
                isPinInputFocused &&
                (pin.length === index ||
                  (pin.length === PARENT_PIN_LENGTH &&
                    index === PARENT_PIN_LENGTH - 1));

              return (
                <View
                  key={slotKey}
                  style={[
                    styles.pinSlot,
                    isFilled && styles.pinSlotFilled,
                    isErrorState && styles.pinSlotError,
                    isSuccessState && styles.pinSlotSuccess,
                    isActive && styles.pinSlotActive,
                  ]}
                  testID={`parent-pin-slot-${index}`}
                >
                  {shouldRevealDigit ? (
                    <Text
                      style={styles.pinDigit}
                      testID={`parent-pin-slot-digit-${index}`}
                    >
                      {digit}
                    </Text>
                  ) : isFilled ? (
                    <View
                      style={styles.pinMask}
                      testID={`parent-pin-slot-digit-${index}`}
                    />
                  ) : (
                    <View
                      style={styles.pinPlaceholder}
                      testID={`parent-pin-slot-digit-${index}`}
                    />
                  )}
                </View>
              );
            })}
          </View>
          <TextInput
            accessibilityLabel={copy.accessibilityLabel}
            caretHidden
            keyboardType="number-pad"
            key={copy.accessibilityLabel}
            maxLength={PARENT_PIN_LENGTH}
            editable={!isUnlockSuccessPending}
            onBlur={() => setIsPinInputFocused(false)}
            onChangeText={handlePinChange}
            onFocus={() => setIsPinInputFocused(true)}
            placeholder=""
            placeholderTextColor={tokens.textMuted}
            ref={pinInputRef}
            selection={{ end: pin.length, start: pin.length }}
            showSoftInputOnFocus
            style={styles.hiddenInput}
            value={pin}
          />
        </View>
        {effectiveMode !== 'unlock' && errorMessage ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : null}
        {effectiveMode === 'unlock' ? (
          canDismiss ? (
            <LoggedPressable
              logLabel="Cancel Parent Unlock"
              onPress={closeModal}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </LoggedPressable>
          ) : null
        ) : (
          <View style={styles.actions}>
            {canDismiss ? (
              <LoggedPressable
                logLabel="Cancel Parent Unlock"
                onPress={closeModal}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </LoggedPressable>
            ) : null}
            <LoggedPressable
              logLabel={actionConfirmLabel ?? ''}
              onPress={() => submitPin(pin)}
              style={styles.primaryAction}
            >
              <Text style={styles.primaryText}>{actionConfirmLabel}</Text>
            </LoggedPressable>
          </View>
        )}
      </View>
    </KeyboardModalFrame>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    card: {
      alignSelf: 'center',
      backgroundColor: tokens.modalSurface,
      borderColor: tokens.border,
      borderRadius: 22,
      borderWidth: 1,
      flexShrink: 1,
      gap: 10,
      maxHeight: '100%',
      maxWidth: 360,
      paddingHorizontal: 18,
      paddingVertical: 18,
      width: '92%',
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
      lineHeight: BODY_LINE_HEIGHT,
    },
    unlockBody: {
      minHeight: BODY_LINE_HEIGHT * UNLOCK_BODY_MIN_LINES,
    },
    bodyError: {
      color: tokens.critical,
      fontWeight: '700',
    },
    pinEntry: {
      minHeight: 72,
      position: 'relative',
    },
    pinRow: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
    },
    pinSlot: {
      alignItems: 'center',
      backgroundColor: tokens.inputSurface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 3,
      flexBasis: 0,
      flexGrow: 1,
      justifyContent: 'center',
      maxWidth: 72,
      minHeight: 72,
    },
    pinSlotFilled: {
      borderColor: tokens.accent,
    },
    pinSlotActive: {
      borderColor: tokens.accent,
      shadowColor: tokens.accent,
      shadowOffset: {
        height: 0,
        width: 0,
      },
      shadowOpacity: 0.16,
      shadowRadius: 10,
    },
    pinSlotError: {
      borderColor: tokens.critical,
      shadowColor: tokens.critical,
      shadowOffset: {
        height: 0,
        width: 0,
      },
      shadowOpacity: 0.2,
      shadowRadius: 10,
    },
    pinSlotSuccess: {
      borderColor: tokens.success,
      shadowColor: tokens.success,
      shadowOffset: {
        height: 0,
        width: 0,
      },
      shadowOpacity: 0.18,
      shadowRadius: 10,
    },
    pinDigit: {
      color: tokens.textPrimary,
      fontSize: 28,
      fontWeight: '800',
    },
    pinMask: {
      backgroundColor: tokens.textPrimary,
      borderRadius: 999,
      height: 12,
      width: 12,
    },
    pinPlaceholder: {
      height: 12,
      width: 12,
    },
    hiddenInput: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
      color: 'transparent',
      opacity: 0.02,
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
