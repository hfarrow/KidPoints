import { Feather } from '@expo/vector-icons';
import { type ReactNode, useEffect, useState } from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import {
  type useAppTheme,
  useThemedStyles,
} from '../features/theme/themeContext';

type TileProps = {
  accessibilityLabel?: string;
  title: ReactNode;
  eyebrow?: string;
  children?: ReactNode;
  compact?: boolean;
  collapsed?: boolean;
  collapsedSummary?: ReactNode;
  collapsedTitle?: ReactNode;
  collapsedTitlePrefix?: ReactNode;
  collapsible?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  floatingTitle?: boolean;
  headerAccessory?: ReactNode;
  initiallyCollapsed?: boolean;
  onCollapsedChange?: (isCollapsed: boolean) => void;
  summaryVisibleWhenExpanded?: boolean;
  titlePrefixVisibleWhenExpanded?: boolean;
};

export function Tile({
  accessibilityLabel,
  title,
  eyebrow,
  children,
  compact = false,
  collapsed,
  collapsedSummary,
  collapsedTitle,
  collapsedTitlePrefix,
  collapsible = true,
  containerStyle,
  floatingTitle = false,
  headerAccessory,
  initiallyCollapsed = false,
  onCollapsedChange,
  summaryVisibleWhenExpanded = false,
  titlePrefixVisibleWhenExpanded = false,
}: TileProps) {
  const styles = useThemedStyles(createStyles);
  const [internalIsCollapsed, setInternalIsCollapsed] =
    useState(initiallyCollapsed);
  const isCollapsed = collapsed ?? internalIsCollapsed;
  const showCollapsedSummary = isCollapsed || summaryVisibleWhenExpanded;
  const showTitlePrefix = isCollapsed || titlePrefixVisibleWhenExpanded;
  const displayedTitle = isCollapsed && collapsedTitle ? collapsedTitle : title;

  useEffect(() => {
    if (collapsed === undefined) {
      return;
    }

    setInternalIsCollapsed(collapsed);
  }, [collapsed]);

  const toggleCollapsed = () => {
    if (!collapsible) {
      return;
    }

    const nextIsCollapsed = !isCollapsed;
    setInternalIsCollapsed(nextIsCollapsed);
    onCollapsedChange?.(nextIsCollapsed);
  };

  const renderTitleContent = (titleStyle: StyleProp<TextStyle>) => {
    if (
      typeof displayedTitle === 'string' ||
      typeof displayedTitle === 'number'
    ) {
      return (
        <Text numberOfLines={1} style={titleStyle}>
          {displayedTitle}
        </Text>
      );
    }

    return <View style={styles.customTitleWrap}>{displayedTitle}</View>;
  };

  return (
    <View
      style={[
        styles.tile,
        compact && styles.tileCompact,
        floatingTitle && styles.tileWithFloatingTitle,
        compact && floatingTitle && styles.tileWithFloatingTitleCompact,
        containerStyle,
      ]}
    >
      {floatingTitle ? (
        <Pressable
          disabled={!collapsible}
          onPress={toggleCollapsed}
          style={[
            styles.floatingTitleWrap,
            compact && styles.floatingTitleWrapCompact,
          ]}
        >
          {renderTitleContent([
            styles.floatingTitle,
            compact && styles.floatingTitleCompact,
          ])}
        </Pressable>
      ) : null}
      <Pressable
        accessibilityLabel={accessibilityLabel}
        disabled={!collapsible}
        onPress={toggleCollapsed}
        style={[styles.header, compact && styles.headerCompact]}
      >
        <View
          style={[
            styles.headerCopy,
            compact && styles.headerCopyCompact,
            floatingTitle && styles.headerCopyFloatingTitle,
          ]}
        >
          {eyebrow ? (
            <Text style={[styles.eyebrow, compact && styles.eyebrowCompact]}>
              {eyebrow}
            </Text>
          ) : null}
          {floatingTitle ? null : (
            <View style={styles.titleRow}>
              {showTitlePrefix && collapsedTitlePrefix ? (
                <View pointerEvents="box-none">{collapsedTitlePrefix}</View>
              ) : null}
              {renderTitleContent([
                styles.title,
                compact && styles.titleCompact,
              ])}
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
                compact && styles.summaryCompact,
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
                compact && styles.chevronRailCompact,
              ]}
            >
              <View
                style={[
                  styles.chevronButton,
                  compact && styles.chevronButtonCompact,
                ]}
              >
                <Feather
                  color={styles.chevron.color}
                  name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                  size={compact ? 16 : 18}
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
    tileCompact: {
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: {
        width: 0,
        height: 3,
      },
      elevation: 1,
    },
    tileWithFloatingTitle: {
      marginTop: 20,
      paddingTop: 26,
      overflow: 'visible',
    },
    tileWithFloatingTitleCompact: {
      marginTop: 16,
      paddingTop: 22,
    },
    floatingTitleWrap: {
      position: 'absolute',
      left: 18,
      right: 18,
      top: 0,
      transform: [{ translateY: -14 }],
      zIndex: 1,
    },
    floatingTitleWrapCompact: {
      left: 14,
      right: 14,
      transform: [{ translateY: -12 }],
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
    floatingTitleCompact: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      fontSize: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerCompact: {
      gap: 8,
    },
    headerCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    headerCopyCompact: {
      gap: 0,
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
    summaryCompact: {
      marginRight: 0,
    },
    summaryFloatingTitle: {
      marginRight: 0,
    },
    chevronRail: {
      flexShrink: 0,
    },
    chevronRailCompact: {
      width: 34,
      alignItems: 'flex-end',
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
    eyebrowCompact: {
      fontSize: 10,
    },
    title: {
      fontSize: 21,
      fontWeight: '800',
      flexShrink: 1,
      color: tokens.textPrimary,
    },
    customTitleWrap: {
      flexShrink: 1,
      minWidth: 0,
    },
    titleCompact: {
      fontSize: 15,
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
    chevronButtonCompact: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
  });
