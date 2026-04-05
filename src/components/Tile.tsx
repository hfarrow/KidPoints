import { Feather } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  type useAppTheme,
  useThemedStyles,
} from '../features/theme/themeContext';

type TileProps = {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
  collapsedSummary?: ReactNode;
  collapsedTitle?: string;
  collapsedTitlePrefix?: ReactNode;
  collapsible?: boolean;
  floatingTitle?: boolean;
  headerAccessory?: ReactNode;
  initiallyCollapsed?: boolean;
  summaryVisibleWhenExpanded?: boolean;
  titlePrefixVisibleWhenExpanded?: boolean;
};

export function Tile({
  title,
  eyebrow,
  children,
  collapsedSummary,
  collapsedTitle,
  collapsedTitlePrefix,
  collapsible = true,
  floatingTitle = false,
  headerAccessory,
  initiallyCollapsed = false,
  summaryVisibleWhenExpanded = false,
  titlePrefixVisibleWhenExpanded = false,
}: TileProps) {
  const styles = useThemedStyles(createStyles);
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);
  const showCollapsedSummary = isCollapsed || summaryVisibleWhenExpanded;
  const showTitlePrefix = isCollapsed || titlePrefixVisibleWhenExpanded;
  const displayedTitle = isCollapsed && collapsedTitle ? collapsedTitle : title;
  const toggleCollapsed = () => {
    if (!collapsible) {
      return;
    }

    setIsCollapsed((current) => !current);
  };

  return (
    <View style={[styles.tile, floatingTitle && styles.tileWithFloatingTitle]}>
      {floatingTitle ? (
        <Pressable
          disabled={!collapsible}
          onPress={toggleCollapsed}
          style={styles.floatingTitleWrap}
        >
          <Text numberOfLines={1} style={styles.floatingTitle}>
            {displayedTitle}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        disabled={!collapsible}
        onPress={toggleCollapsed}
        style={styles.header}
      >
        <View
          style={[
            styles.headerCopy,
            floatingTitle && styles.headerCopyFloatingTitle,
          ]}
        >
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          {floatingTitle ? null : (
            <View style={styles.titleRow}>
              {showTitlePrefix && collapsedTitlePrefix ? (
                <View pointerEvents="box-none">{collapsedTitlePrefix}</View>
              ) : null}
              <Text numberOfLines={1} style={styles.title}>
                {displayedTitle}
              </Text>
            </View>
          )}
        </View>
        <View
          style={[
            styles.headerMeta,
            floatingTitle && styles.headerMetaFloatingTitle,
          ]}
        >
          {showCollapsedSummary && collapsedSummary ? (
            <View
              pointerEvents="box-none"
              style={[
                styles.summary,
                floatingTitle && collapsible && styles.summaryFloatingTitle,
              ]}
            >
              {collapsedSummary}
            </View>
          ) : null}
          {headerAccessory ? (
            <View pointerEvents="box-none">{headerAccessory}</View>
          ) : null}
          {collapsible ? (
            <View
              style={[
                styles.chevronRail,
                floatingTitle && styles.chevronRailFloatingTitle,
              ]}
            >
              <View style={styles.chevronButton}>
                <Feather
                  color={styles.chevron.color}
                  name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                  size={18}
                />
              </View>
            </View>
          ) : null}
        </View>
      </Pressable>
      {collapsible && isCollapsed ? null : children}
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    tile: {
      borderRadius: 22,
      backgroundColor: tokens.cardSurface,
      paddingHorizontal: 18,
      paddingVertical: 18,
      gap: 14,
      shadowColor: tokens.shadowColor,
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: {
        width: 0,
        height: 6,
      },
      elevation: 2,
    },
    tileWithFloatingTitle: {
      marginTop: 20,
      paddingTop: 26,
      overflow: 'visible',
    },
    floatingTitleWrap: {
      position: 'absolute',
      left: 18,
      right: 18,
      top: 0,
      transform: [{ translateY: -14 }],
      zIndex: 1,
    },
    floatingTitle: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 5,
      fontSize: 19,
      fontWeight: '900',
      backgroundColor: tokens.floatingLabelSurface,
      color: tokens.textPrimary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    headerCopyFloatingTitle: {
      flex: 0,
      width: 0,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerMeta: {
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerMetaFloatingTitle: {
      flex: 1,
      justifyContent: 'space-between',
    },
    summary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
    },
    summaryFloatingTitle: {
      marginRight: 0,
    },
    chevronRail: {
      flexShrink: 0,
    },
    chevronRailFloatingTitle: {
      width: 52,
      alignItems: 'flex-end',
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: tokens.accentText,
    },
    title: {
      fontSize: 21,
      fontWeight: '800',
      flexShrink: 1,
      color: tokens.textPrimary,
    },
    chevron: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.controlTextMuted,
    },
    chevronButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.controlSurface,
    },
  });
