import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';
import { useParentSession } from './parentSessionContext';

export function ParentUnlockModal() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { attemptUnlock } = useParentSession();
  const { tokens } = useAppTheme();
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const submitPin = (value: string) => {
    const didUnlock = attemptUnlock(value);

    if (!didUnlock) {
      setErrorMessage('That PIN does not match the temporary parent code.');
      return;
    }

    router.back();
  };

  return (
    <View style={[styles.backdrop, { backgroundColor: tokens.modalBackdrop }]}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Parent Mode</Text>
        <Text style={styles.title}>Unlock Parent Controls</Text>
        <Text style={styles.body}>
          Enter the temporary PIN to view parent-gated controls. The default PIN
          for this milestone is `0000`.
        </Text>
        <TextInput
          accessibilityLabel="Parent PIN"
          autoFocus
          keyboardType="number-pad"
          onChangeText={(nextValue) => {
            setPin(nextValue);
            if (errorMessage) {
              setErrorMessage('');
            }

            if (attemptUnlock(nextValue)) {
              router.back();
            }
          }}
          placeholder="0000"
          placeholderTextColor={tokens.textMuted}
          secureTextEntry
          style={styles.input}
          value={pin}
        />
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.back()}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => submitPin(pin)}
            style={styles.primaryAction}
          >
            <Text style={styles.primaryText}>Unlock</Text>
          </Pressable>
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
      borderRadius: 24,
      borderWidth: 1,
      gap: 10,
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
