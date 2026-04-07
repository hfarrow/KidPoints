import type { ReactNode } from 'react';
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

type TileProps = {
  accessory?: ReactNode;
  children?: ReactNode;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
  summary?: ReactNode;
  title: ReactNode;
};

export function Tile({
  accessory,
  children,
  muted = false,
  style,
  summary,
  title,
}: TileProps) {
  const styles = useThemedStyles(createStyles);
  const titleNode =
    typeof title === 'string' ? (
      <Text style={styles.title}>{title}</Text>
    ) : (
      title
    );

  return (
    <View style={[styles.tile, muted && styles.tileMuted, style]}>
      <View style={styles.headerRow}>{titleNode}</View>
      <View style={styles.contentWrap}>
        {summary || accessory ? (
          <View style={styles.summaryRow}>
            {summary ? <View style={styles.summary}>{summary}</View> : <View />}
            {accessory ? (
              <View style={styles.accessory}>{accessory}</View>
            ) : null}
          </View>
        ) : null}
        {children}
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
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      minHeight: 20,
    },
    title: {
      color: tokens.textPrimary,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
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
  });
