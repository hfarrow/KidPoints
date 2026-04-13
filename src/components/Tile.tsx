import { Feather } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import {
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { type useAppTheme, useThemedStyles } from '../features/theme/appTheme';
import { LoggedPressable } from './LoggedPressable';

type TileProps = {
  accessory?: ReactNode;
  children?: ReactNode;
  collapsed?: boolean;
  collapsible?: boolean;
  collapsibleLabel?: string;
  density?: 'default' | 'extraCompact';
  disableCollapseLogging?: boolean;
  footer?: ReactNode;
  headerHidden?: boolean;
  initiallyCollapsed?: boolean;
  leadingAccessory?: ReactNode;
  muted?: boolean;
  onCollapsedChange?: (isCollapsed: boolean) => void;
  style?: StyleProp<ViewStyle>;
  summary?: ReactNode;
  testID?: string;
  title: ReactNode;
};

export function Tile({
  accessory,
  children,
  collapsed,
  collapsible = false,
  collapsibleLabel,
  density = 'default',
  disableCollapseLogging = false,
  footer,
  headerHidden = false,
  initiallyCollapsed = false,
  leadingAccessory,
  muted = false,
  onCollapsedChange,
  style,
  summary,
  testID,
  title,
}: TileProps) {
  const styles = useThemedStyles(createStyles);
  const [uncontrolledCollapsed, setUncontrolledCollapsed] =
    useState(initiallyCollapsed);
  const isCollapsed = collapsed ?? uncontrolledCollapsed;
  const titleText =
    collapsibleLabel ??
    (typeof title === 'string' || typeof title === 'number'
      ? String(title)
      : 'tile');
  const titleNode =
    typeof title === 'string' ? (
      <Text style={styles.title}>{title}</Text>
    ) : (
      title
    );
  const hasVisibleChildren = Boolean(children) && !(collapsible && isCollapsed);
  const hasVisibleContent =
    summary != null || footer != null || hasVisibleChildren;
  const toggleCollapsed = () => {
    const nextCollapsed = !isCollapsed;

    if (collapsed == null) {
      setUncontrolledCollapsed(nextCollapsed);
    }
    onCollapsedChange?.(nextCollapsed);
  };

  return (
    <View
      style={[
        styles.tile,
        density === 'extraCompact' && styles.tileExtraCompact,
        !hasVisibleContent && styles.tileHeaderOnly,
        !hasVisibleContent &&
          density === 'extraCompact' &&
          styles.tileExtraCompactHeaderOnly,
        muted && styles.tileMuted,
        style,
      ]}
      testID={testID}
    >
      <View style={styles.frame}>
        {leadingAccessory ? (
          <View
            style={[
              styles.leadingAccessoryWrap,
              density === 'extraCompact' && styles.leadingAccessoryWrapCompact,
            ]}
          >
            {leadingAccessory}
          </View>
        ) : null}
        <View style={styles.body}>
          {!headerHidden ? (
            collapsible ? (
              <LoggedPressable
                accessibilityLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${titleText}`}
                accessibilityRole="button"
                disableLogging={disableCollapseLogging}
                logContext={{
                  component: 'Tile',
                  isCollapsed,
                  title: titleText,
                }}
                logLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${titleText}`}
                onPress={toggleCollapsed}
                style={[
                  styles.headerRow,
                  density === 'extraCompact' && styles.headerRowExtraCompact,
                ]}
              >
                <View style={styles.titleWrap}>{titleNode}</View>
                {accessory || collapsible ? (
                  <View style={styles.headerActions}>
                    {accessory ? (
                      <View style={styles.accessory}>{accessory}</View>
                    ) : null}
                    <View
                      style={[
                        styles.expanderButton,
                        density === 'extraCompact' &&
                          styles.expanderButtonExtraCompact,
                      ]}
                    >
                      <Feather
                        color={styles.expanderIcon.color}
                        name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                        size={18}
                      />
                    </View>
                  </View>
                ) : null}
              </LoggedPressable>
            ) : (
              <View
                style={[
                  styles.headerRow,
                  density === 'extraCompact' && styles.headerRowExtraCompact,
                ]}
              >
                <View style={styles.titleWrap}>{titleNode}</View>
                {accessory ? (
                  <View style={styles.headerActions}>
                    <View style={styles.accessory}>{accessory}</View>
                  </View>
                ) : null}
              </View>
            )
          ) : null}
          {hasVisibleContent ? (
            <View
              style={[
                styles.contentWrap,
                headerHidden && styles.contentWrapHeaderHidden,
                density === 'extraCompact' && styles.contentWrapExtraCompact,
                density === 'extraCompact' &&
                  headerHidden &&
                  styles.contentWrapHeaderHiddenExtraCompact,
              ]}
            >
              {summary ? (
                <View
                  style={[
                    styles.summaryRow,
                    density === 'extraCompact' && styles.summaryRowExtraCompact,
                  ]}
                >
                  <View style={styles.summary}>{summary}</View>
                </View>
              ) : null}
              {hasVisibleChildren ? children : null}
              {footer ? <View style={styles.footerWrap}>{footer}</View> : null}
            </View>
          ) : null}
        </View>
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
    tileExtraCompact: {
      borderRadius: 16,
      paddingBottom: 8,
      paddingHorizontal: 10,
      paddingTop: 6,
    },
    tileHeaderOnly: {
      paddingBottom: 8,
    },
    tileExtraCompactHeaderOnly: {
      paddingBottom: 6,
    },
    tileMuted: {
      backgroundColor: tokens.tileMutedSurface,
    },
    frame: {
      alignItems: 'stretch',
      flexDirection: 'row',
      gap: 8,
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
      minHeight: 32,
    },
    headerRowExtraCompact: {
      gap: 8,
      minHeight: 28,
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
    contentWrapHeaderHidden: {
      paddingTop: 0,
    },
    contentWrapExtraCompact: {
      gap: 6,
      paddingTop: 4,
    },
    contentWrapHeaderHiddenExtraCompact: {
      paddingTop: 0,
    },
    summaryRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
      minWidth: 0,
    },
    summaryRowExtraCompact: {
      gap: 6,
    },
    summary: {
      flex: 1,
      minWidth: 0,
    },
    accessory: {
      flexShrink: 0,
    },
    leadingAccessoryWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    leadingAccessoryWrapCompact: {
      paddingVertical: 2,
    },
    footerWrap: {
      paddingTop: 2,
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
    expanderButtonExtraCompact: {
      borderRadius: 14,
      height: 28,
      width: 28,
    },
    expanderIcon: {
      color: tokens.controlText,
    },
  });
