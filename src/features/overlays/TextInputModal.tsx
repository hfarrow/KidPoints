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
import {
  KeyboardAvoidingView,
  useResizeMode,
} from 'react-native-keyboard-controller';

import { LoggedPressable } from '../../components/LoggedPressable';
import { ActionPill } from '../../components/Skeleton';
import { createModuleLogger } from '../../logging/logger';
import { isBlockingRouteModalPath } from '../../navigation/modalPaths';
import { scheduleAfterFrameCommit } from '../../timing/scheduleAfterFrameCommit';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';
import {
  clearTextInputModal,
  type TextInputModalRequest,
  useTextInputModalStore,
} from './textInputModalStore';

const log = createModuleLogger('text-input-modal');

type ActiveTextInputModalProps = {
  errorMessage: string;
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
  useResizeMode();

  useEffect(() => {
    return scheduleAfterFrameCommit(() => {
      inputRef.current?.focus();
    });
  }, [inputRef]);

  return (
    <View
      style={[styles.overlayRoot, { backgroundColor: tokens.modalBackdrop }]}
    >
      <KeyboardAvoidingView
        behavior="height"
        style={styles.keyboardFrame}
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
      </KeyboardAvoidingView>
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

  const handleSave = () => {
    if (!request) {
      clearRequest();
      return;
    }

    if (!isParentUnlocked) {
      router.push('/parent-unlock');
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
    keyboardFrame: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 18,
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
