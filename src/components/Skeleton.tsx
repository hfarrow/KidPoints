import type { PropsWithChildren, ReactNode } from 'react';
import {
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import {
  type useAppTheme,
  useThemedStyles,
} from '../features/theme/themeContext';
import { LoggedPressable } from './LoggedPressable';

export function SkeletonLine({
  width = '100%',
}: {
  width?: number | `${number}%`;
}) {
  const styles = useThemedStyles(createStyles);

  return <View style={[styles.line, { width }]} />;
}

export function SkeletonCluster({
  lines,
}: {
  lines: (number | `${number}%`)[];
}) {
  const styles = useThemedStyles(createStyles);
  const lineCounts = new Map<number | `${number}%`, number>();

  return (
    <View style={styles.cluster}>
      {lines.map((line) => {
        const count = lineCounts.get(line) ?? 0;
        lineCounts.set(line, count + 1);

        return <SkeletonLine key={`${line}-${count}`} width={line} />;
      })}
    </View>
  );
}

export function ActionPill({
  label,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  onPress?: () => void;
  tone?: 'critical' | 'neutral' | 'primary';
}) {
  const styles = useThemedStyles(createStyles);
  const toneStyle =
    tone === 'primary'
      ? styles.primaryPill
      : tone === 'critical'
        ? styles.criticalPill
        : styles.neutralPill;
  const textStyle =
    tone === 'primary'
      ? styles.primaryPillText
      : tone === 'critical'
        ? styles.criticalPillText
        : styles.neutralPillText;

  return (
    <LoggedPressable
      accessibilityRole="button"
      logContext={{ tone }}
      logLabel={label}
      onPress={onPress}
      style={[styles.pill, toneStyle]}
    >
      <Text style={[styles.pillText, textStyle]}>{label}</Text>
    </LoggedPressable>
  );
}

export function ActionPillRow({ children }: PropsWithChildren) {
  const styles = useThemedStyles(createStyles);

  return <View style={styles.pillRow}>{children}</View>;
}

export function StatusBadge({
  label,
  size = 'default',
  tone = 'neutral',
}: {
  label: string;
  size?: 'default' | 'mini';
  tone?: 'good' | 'neutral' | 'warning';
}) {
  const styles = useThemedStyles(createStyles);
  const toneStyle =
    tone === 'good'
      ? styles.goodBadge
      : tone === 'warning'
        ? styles.warningBadge
        : styles.neutralBadge;

  return (
    <View
      style={[styles.badge, size === 'mini' && styles.badgeMini, toneStyle]}
    >
      <Text style={[styles.badgeText, size === 'mini' && styles.badgeTextMini]}>
        {label}
      </Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(createStyles);

  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function CompactSurface({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const styles = useThemedStyles(createStyles);

  return <View style={[styles.surface, style]}>{children}</View>;
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    cluster: {
      gap: 7,
    },
    line: {
      backgroundColor: tokens.skeleton,
      borderRadius: 999,
      height: 10,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    pill: {
      alignItems: 'center',
      borderRadius: 999,
      justifyContent: 'center',
      minHeight: 34,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    pillText: {
      fontSize: 13,
      fontWeight: '800',
    },
    neutralPill: {
      backgroundColor: tokens.controlSurface,
    },
    neutralPillText: {
      color: tokens.controlText,
    },
    primaryPill: {
      backgroundColor: tokens.accent,
    },
    primaryPillText: {
      color: '#f8fafc',
    },
    criticalPill: {
      backgroundColor: tokens.criticalSurface,
    },
    criticalPillText: {
      color: tokens.critical,
    },
    badge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    badgeMini: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    badgeTextMini: {
      fontSize: 9,
      letterSpacing: 0.3,
    },
    goodBadge: {
      backgroundColor: tokens.successSurface,
    },
    neutralBadge: {
      backgroundColor: tokens.controlSurface,
    },
    warningBadge: {
      backgroundColor: tokens.floatingLabelSurface,
    },
    sectionLabel: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    surface: {
      backgroundColor: tokens.controlSurface,
      borderRadius: 14,
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
  });
