import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionPill } from '../../components/Skeleton';
import { selectChildById, useSharedStore } from '../../state/sharedStore';
import { useShellSession } from '../shell/shellContext';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';

export function EditDialogScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const { isParentUnlocked } = useShellSession();
  const params = useLocalSearchParams<{
    childId?: string | string[];
    mode?: string | string[];
  }>();
  const addChild = useSharedStore((state) => state.addChild);
  const setPoints = useSharedStore((state) => state.setPoints);
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const childId = Array.isArray(params.childId)
    ? params.childId[0]
    : params.childId;
  const child = useSharedStore(selectChildById(childId ?? ''));
  const dialogMode = mode === 'set-points' ? 'set-points' : 'add-child';
  const [value, setValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (dialogMode === 'set-points' && child) {
      setValue(String(child.points));
      return;
    }

    setValue('');
  }, [child, dialogMode]);

  const copy = useMemo(() => {
    if (dialogMode === 'set-points') {
      return {
        body: child
          ? `Set the exact point total for ${child.name}. This records a transaction without editing history in place.`
          : 'That child could not be found from the current Home state.',
        eyebrow: 'Exact total',
        primaryLabel: 'Save total',
        title: child ? 'Edit point total' : 'Child not found',
      };
    }

    return {
      body: 'Create a child tile on Home. The transaction engine will record the creation event immediately.',
      eyebrow: 'Add child',
      primaryLabel: 'Save child',
      title: 'Create child',
    };
  }, [child, dialogMode]);

  const handleSave = () => {
    if (!isParentUnlocked) {
      router.push('/parent-unlock');
      return;
    }

    if (dialogMode === 'set-points') {
      if (!childId) {
        setErrorMessage('Pick a child before editing points.');
        return;
      }

      if (!/^-?\d+$/.test(value.trim())) {
        setErrorMessage('Enter a whole-number point total.');
        return;
      }

      const result = setPoints(childId, Number(value.trim()));

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      router.back();
      return;
    }

    const result = addChild(value);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    router.back();
  };

  return (
    <View style={[styles.backdrop, { backgroundColor: tokens.modalBackdrop }]}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        {isParentUnlocked ? null : (
          <Text style={styles.lockedCopy}>
            Unlock Parent Mode to save changes here.
          </Text>
        )}
        {dialogMode === 'set-points' && !child ? null : (
          <TextInput
            accessibilityLabel={
              dialogMode === 'set-points' ? 'Exact point total' : 'Child name'
            }
            keyboardType={
              dialogMode === 'set-points' ? 'number-pad' : 'default'
            }
            onChangeText={(nextValue) => {
              setValue(nextValue);
              if (errorMessage) {
                setErrorMessage('');
              }
            }}
            placeholder={dialogMode === 'set-points' ? '0' : 'Ava'}
            placeholderTextColor={tokens.textMuted}
            style={styles.input}
            value={value}
          />
        )}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <View style={styles.footer}>
          <ActionPill label="Dismiss" onPress={() => router.back()} />
          {isParentUnlocked ? (
            <ActionPill
              label={copy.primaryLabel}
              onPress={handleSave}
              tone="primary"
            />
          ) : (
            <Pressable
              onPress={() => router.push('/parent-unlock')}
              style={styles.primaryAction}
            >
              <Text style={styles.primaryActionText}>Unlock Parent Mode</Text>
            </Pressable>
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
    eyebrow: {
      color: tokens.accent,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
    },
    title: {
      color: tokens.textPrimary,
      fontSize: 22,
      fontWeight: '900',
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
