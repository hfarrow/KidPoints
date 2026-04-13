import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardModalFrame } from '../../components/KeyboardModalFrame';
import { LoggedPressable } from '../../components/LoggedPressable';
import { ActionPill } from '../../components/Skeleton';
import { createModuleLogger } from '../../logging/logger';
import { isBlockingRouteModalPath } from '../../navigation/modalPaths';
import { scheduleAfterFrameCommit } from '../../timing/scheduleAfterFrameCommit';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import {
  clearTextInputModal,
  type TextInputModalRequest,
  useTextInputModalStore,
} from './textInputModalStore';

const log = createModuleLogger('text-input-modal');

type ActiveTextInputModalProps = {
  errorMessage: string;
  handleClear: () => void;
  handleClose: () => void;
  handleSave: () => void;
  inputRef: React.RefObject<TextInput | null>;
  isParentUnlocked: boolean;
  request: TextInputModalRequest;
  setErrorMessage: (value: string) => void;
  setValue: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
  tokens: ReturnType<typeof useAppTheme>['tokens'];
  value: string;
};
function ActiveTextInputModal({
  errorMessage,
  handleClear,
  handleClose,
  handleSave,
  inputRef,
  isParentUnlocked,
  request,
  setErrorMessage,
  setValue,
  styles,
  tokens,
  value,
}: ActiveTextInputModalProps) {
  useEffect(() => {
    log.debug('Scheduling text input modal focus after frame commit', {
      inputAccessibilityLabel: request.inputAccessibilityLabel,
      requestId: request.requestId,
    });

    return scheduleAfterFrameCommit(() => {
      log.debug('Running scheduled text input modal focus', {
        inputAccessibilityLabel: request.inputAccessibilityLabel,
        requestId: request.requestId,
      });
      inputRef.current?.focus();
    });
  }, [inputRef, request.inputAccessibilityLabel, request.requestId]);

  return (
    <View style={styles.overlayRoot}>
      <KeyboardModalFrame
        contentTestID="text-input-keyboard-content"
        hideUntilKeyboardPositioned={false}
        initialVerticalPosition="bottom"
        style={{ backgroundColor: tokens.modalBackdrop }}
        testID="text-input-keyboard-frame"
      >
        <View style={styles.card}>
          <Text style={styles.title}>{request.title}</Text>
          <Text style={styles.body}>{request.description}</Text>
          {isParentUnlocked ? null : (
            <Text style={styles.lockedCopy}>
              Unlock Parent Mode to save changes here.
            </Text>
          )}
          <TextInput
            accessibilityLabel={request.inputAccessibilityLabel}
            keyboardType={request.keyboardType ?? 'default'}
            onChangeText={(nextValue) => {
              setValue(nextValue);
              if (errorMessage) {
                setErrorMessage('');
              }
            }}
            onBlur={() => {
              log.debug('Text input modal input blurred', {
                inputAccessibilityLabel: request.inputAccessibilityLabel,
                requestId: request.requestId,
              });
            }}
            onFocus={() => {
              log.debug('Text input modal input focused', {
                inputAccessibilityLabel: request.inputAccessibilityLabel,
                requestId: request.requestId,
              });
            }}
            placeholder={request.placeholder ?? ''}
            placeholderTextColor={tokens.textMuted}
            ref={inputRef}
            showSoftInputOnFocus
            style={styles.input}
            value={value}
          />
          {errorMessage ? (
            <Text style={styles.error}>{errorMessage}</Text>
          ) : null}
          <View style={styles.footer}>
            <ActionPill label="Cancel" onPress={handleClose} />
            {request.onClear ? (
              <ActionPill
                label={request.clearLabel ?? 'Clear'}
                onPress={handleClear}
              />
            ) : null}
            {isParentUnlocked ? (
              <ActionPill
                label={request.confirmLabel}
                onPress={handleSave}
                tone="primary"
              />
            ) : (
              <LoggedPressable
                logLabel="Unlock Parent Mode"
                onPress={handleSave}
                style={styles.primaryAction}
              >
                <Text style={styles.primaryActionText}>Unlock Parent Mode</Text>
              </LoggedPressable>
            )}
          </View>
        </View>
      </KeyboardModalFrame>
    </View>
  );
}

export function TextInputModal() {
  const router = useRouter();
  const pathname = usePathname();
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const { isParentUnlocked } = useParentSession();
  const clearRequest = useTextInputModalStore((state) => state.clearRequest);
  const request = useTextInputModalStore((state) => state.request);
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    log.debug('Text input modal initialized');
  }, []);

  useEffect(() => {
    if (!request) {
      setValue('');
      setErrorMessage('');
      return;
    }

    log.debug('Text input modal request activated', {
      inputAccessibilityLabel: request.inputAccessibilityLabel,
      requestId: request.requestId,
      title: request.title,
    });

    setValue(request.initialValue ?? '');
    setErrorMessage('');
  }, [request]);

  useEffect(() => {
    return () => {
      Keyboard.dismiss();
      clearTextInputModal();
    };
  }, []);

  const isVisible = !!request && !isBlockingRouteModalPath(pathname);

  useEffect(() => {
    if (!request) {
      return;
    }

    log.debug('Text input modal visibility changed', {
      isVisible,
      pathname,
      requestId: request.requestId,
    });
  }, [isVisible, pathname, request]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        clearRequest();
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [clearRequest, isVisible]);

  const closeInputModal = () => {
    inputRef.current?.blur();
    Keyboard.dismiss();
    clearRequest();
  };

  const handleClose = () => {
    closeInputModal();
  };

  const handleClear = () => {
    if (!request?.onClear) {
      return;
    }

    request.onClear();
    setValue('');
    setErrorMessage('');
    inputRef.current?.focus();
  };

  const handleSave = () => {
    if (!request) {
      clearRequest();
      return;
    }

    if (!isParentUnlocked) {
      router.navigate('/parent-unlock');
      return;
    }

    const result = request.onSubmit(value);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    closeInputModal();
  };

  if (!request || !isVisible) {
    return null;
  }

  return (
    <ActiveTextInputModal
      errorMessage={errorMessage}
      handleClear={handleClear}
      handleClose={handleClose}
      handleSave={handleSave}
      inputRef={inputRef}
      isParentUnlocked={isParentUnlocked}
      key={request.requestId}
      request={request}
      setErrorMessage={setErrorMessage}
      setValue={setValue}
      styles={styles}
      tokens={tokens}
      value={value}
    />
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    overlayRoot: {
      ...StyleSheet.absoluteFillObject,
      elevation: 1000,
      zIndex: 1000,
    },
    card: {
      backgroundColor: tokens.modalSurface,
      borderColor: tokens.border,
      borderRadius: 22,
      borderWidth: 1,
      flexShrink: 1,
      gap: 10,
      maxHeight: '100%',
      maxWidth: 420,
      paddingHorizontal: 18,
      paddingVertical: 18,
      width: '100%',
    },
    title: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    body: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    error: {
      color: tokens.critical,
      fontSize: 13,
      fontWeight: '700',
    },
    footer: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'flex-end',
      marginTop: 4,
    },
    input: {
      backgroundColor: tokens.inputSurface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      color: tokens.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    lockedCopy: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    primaryAction: {
      alignItems: 'center',
      backgroundColor: tokens.accent,
      borderRadius: 999,
      justifyContent: 'center',
      minHeight: 34,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    primaryActionText: {
      color: '#f8fafc',
      fontSize: 13,
      fontWeight: '800',
    },
  });
