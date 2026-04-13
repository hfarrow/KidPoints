import type { PropsWithChildren, ReactNode } from 'react';
import {
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { type useAppTheme, useThemedStyles } from '../features/theme/appTheme';
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
  accessibilityLabel,
  disablePressDebounce = false,
  disableLogging = false,
  icon,
  iconOnly = false,
  label,
  onPress,
  pressDebounceMs,
  testID,
  tone = 'neutral',
}: {
  accessibilityLabel?: string;
  disablePressDebounce?: boolean;
  disableLogging?: boolean;
  icon?: ReactNode;
  iconOnly?: boolean;
  label?: string;
  onPress?: () => void;
  pressDebounceMs?: number;
  testID?: string;
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
  const resolvedAccessibilityLabel = accessibilityLabel ?? label ?? 'Action';
  const resolvedLogLabel = label ?? accessibilityLabel ?? 'Action';

  return (
    <LoggedPressable
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityRole="button"
      disablePressDebounce={disablePressDebounce}
      disableLogging={disableLogging}
      logContext={{ tone }}
      logLabel={resolvedLogLabel}
      onPress={onPress}
      pressDebounceMs={pressDebounceMs}
      style={[styles.pill, toneStyle, iconOnly && styles.iconOnlyPill]}
      testID={testID}
    >
      <View style={styles.pillContent}>
        {icon}
        {label ? (
          <Text style={[styles.pillText, textStyle]}>{label}</Text>
        ) : null}
      </View>
    </LoggedPressable>
  );
}

export function ActionPillRow({ children }: PropsWithChildren) {
  const styles = useThemedStyles(createStyles);

  return <View style={styles.pillRow}>{children}</View>;
}

export function StatusBadge({
  badgeStyle,
  label,
  labelStyle,
  size = 'default',
  testID,
  tone = 'neutral',
}: {
  badgeStyle?: StyleProp<ViewStyle>;
  label: string;
  labelStyle?: StyleProp<TextStyle>;
  size?: 'default' | 'mini';
  testID?: string;
  tone?: 'good' | 'neutral' | 'warning';
}) {
  const styles = useThemedStyles(createStyles);
  const toneStyle =
    tone === 'good'
      ? styles.goodBadge
      : tone === 'warning'
        ? styles.warningBadge
        : styles.neutralBadge;
  const toneTextStyle =
    tone === 'good'
      ? styles.goodBadgeText
      : tone === 'warning'
        ? styles.warningBadgeText
        : styles.neutralBadgeText;

  return (
    <View
      style={[
        styles.badge,
        size === 'mini' && styles.badgeMini,
        toneStyle,
        badgeStyle,
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.badgeText,
          toneTextStyle,
          size === 'mini' && styles.badgeTextMini,
          labelStyle,
        ]}
      >
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
  testID,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; testID?: string }>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.surface, style]} testID={testID}>
      {children}
    </View>
  );
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
    pillContent: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
    },
    iconOnlyPill: {
      minWidth: 34,
      paddingHorizontal: 8,
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
      color: tokens.controlText,
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
    goodBadgeText: {
      color: tokens.successText,
    },
    neutralBadge: {
      backgroundColor: tokens.controlSurface,
    },
    neutralBadgeText: {
      color: tokens.controlText,
    },
    warningBadge: {
      backgroundColor: tokens.floatingLabelSurface,
    },
    warningBadgeText: {
      color: tokens.warningText,
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
