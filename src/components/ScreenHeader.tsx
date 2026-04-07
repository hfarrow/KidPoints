import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  type useAppTheme,
  useThemedStyles,
} from '../features/theme/themeContext';

type ScreenHeaderProps = {
  actions?: ReactNode;
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

export function ScreenHeader({
  actions,
  eyebrow,
  subtitle,
  title,
}: ScreenHeaderProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrap}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    wrap: {
      gap: 8,
    },
    copy: {
      gap: 0,
    },
    eyebrow: {
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
    },
    title: {
      color: tokens.textPrimary,
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: -0.6,
    },
    subtitle: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
      maxWidth: 320,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
  });
