import { Feather } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import {
  Pressable,
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

type TileProps = {
  accessory?: ReactNode;
  children?: ReactNode;
  collapsible?: boolean;
  initiallyCollapsed?: boolean;
  muted?: boolean;
  onCollapsedChange?: (isCollapsed: boolean) => void;
  style?: StyleProp<ViewStyle>;
  summary?: ReactNode;
  title: ReactNode;
};

export function Tile({
  accessory,
  children,
  collapsible = false,
  initiallyCollapsed = false,
  muted = false,
  onCollapsedChange,
  style,
  summary,
  title,
}: TileProps) {
  const styles = useThemedStyles(createStyles);
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);
  const titleText =
    typeof title === 'string' || typeof title === 'number'
      ? String(title)
      : 'tile';
  const titleNode =
    typeof title === 'string' ? (
      <Text style={styles.title}>{title}</Text>
    ) : (
      title
    );
  const toggleCollapsed = () => {
    const nextCollapsed = !isCollapsed;

    setIsCollapsed(nextCollapsed);
    onCollapsedChange?.(nextCollapsed);
  };

  return (
    <View style={[styles.tile, muted && styles.tileMuted, style]}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>{titleNode}</View>
        {accessory || collapsible ? (
          <View style={styles.headerActions}>
            {accessory ? (
              <View style={styles.accessory}>{accessory}</View>
            ) : null}
            {collapsible ? (
              <Pressable
                accessibilityLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${titleText}`}
                accessibilityRole="button"
                onPress={toggleCollapsed}
                style={styles.expanderButton}
              >
                <Feather
                  color={styles.expanderIcon.color}
                  name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                  size={18}
                />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={styles.contentWrap}>
        {summary ? (
          <View style={styles.summaryRow}>
            <View style={styles.summary}>{summary}</View>
          </View>
        ) : null}
        {collapsible && isCollapsed ? null : children}
      </View>
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    tile: {
      backgroundColor: tokens.tileSurface,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingBottom: 12,
      paddingTop: 8,
    },
    tileMuted: {
      backgroundColor: tokens.tileMutedSurface,
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
      minHeight: 32,
    },
    title: {
      color: tokens.textPrimary,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    titleWrap: {
      flex: 1,
      minWidth: 0,
    },
    headerActions: {
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 0,
      gap: 8,
    },
    contentWrap: {
      gap: 8,
      paddingTop: 6,
    },
    summaryRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
      minWidth: 0,
    },
    summary: {
      flex: 1,
      minWidth: 0,
    },
    accessory: {
      flexShrink: 0,
    },
    expanderButton: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 16,
      flexShrink: 0,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    expanderIcon: {
      color: tokens.controlText,
    },
  });
