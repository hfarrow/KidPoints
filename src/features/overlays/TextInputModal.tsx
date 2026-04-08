import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { LoggedPressable } from '../../components/LoggedPressable';
import { ActionPill } from '../../components/Skeleton';
import { createModuleLogger } from '../../logging/logger';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';
import {
  clearTextInputModal,
  useTextInputModalStore,
} from './textInputModalStore';

const log = createModuleLogger('text-input-modal');

export function TextInputModal() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const { isParentUnlocked } = useParentSession();
  const clearRequest = useTextInputModalStore((state) => state.clearRequest);
  const request = useTextInputModalStore((state) => state.request);
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
      clearTextInputModal();
    };
  }, []);

  const handleSave = () => {
    if (!request) {
      clearRequest();
      router.back();
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

    clearRequest();
    router.back();
  };

  if (!request) {
    return null;
  }

  return (
    <View style={[styles.backdrop, { backgroundColor: tokens.modalBackdrop }]}>
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
          autoFocus
          keyboardType={request.keyboardType ?? 'default'}
          onChangeText={(nextValue) => {
            setValue(nextValue);
            if (errorMessage) {
              setErrorMessage('');
            }
          }}
          placeholder={request.placeholder ?? ''}
          placeholderTextColor={tokens.textMuted}
          style={styles.input}
          value={value}
        />
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <View style={styles.footer}>
          <ActionPill
            label="Cancel"
            onPress={() => {
              clearRequest();
              router.back();
            }}
          />
          {isParentUnlocked ? (
            <ActionPill
              label={request.confirmLabel}
              onPress={handleSave}
              tone="primary"
            />
          ) : (
            <LoggedPressable
              logLabel="Unlock Parent Mode"
              onPress={() => router.push('/parent-unlock')}
              style={styles.primaryAction}
            >
              <Text style={styles.primaryActionText}>Unlock Parent Mode</Text>
            </LoggedPressable>
          )}
        </View>
      </View>
    </View>
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
      borderRadius: 22,
      borderWidth: 1,
      gap: 10,
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
