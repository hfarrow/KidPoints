import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ActionPill } from '../../components/Skeleton';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';

export function EditDialogScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();

  return (
    <View style={[styles.backdrop, { backgroundColor: tokens.modalBackdrop }]}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Edit dialog</Text>
        <Text style={styles.title}>Compact editor placeholder</Text>
        <Text style={styles.body}>
          This routed dialog stands in for exact point edits, child settings,
          and other short focused edits.
        </Text>
        <View style={styles.footer}>
          <ActionPill label="Dismiss" onPress={() => router.back()} />
          <ActionPill label="Primary action" tone="primary" />
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
    footer: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'flex-end',
      marginTop: 4,
    },
  });
