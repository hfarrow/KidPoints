import { type PropsWithChildren, type ReactNode, useEffect } from 'react';
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useThemedStyles } from '../features/theme/appTheme';
import { LoggedPressable } from './LoggedPressable';

type ListScaffoldProps = PropsWithChildren<{
  closeLabel?: string;
  emptyState?: ReactNode;
  footer?: ReactNode;
  onRequestClose: () => void;
  subtitle?: string;
  title: string;
  visible: boolean;
}>;

export function ListScaffold({
  children,
  closeLabel = 'Close',
  emptyState,
  footer,
  onRequestClose,
  subtitle,
  title,
  visible,
}: ListScaffoldProps) {
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  useEffect(() => {
    if (!visible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onRequestClose();
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [onRequestClose, visible]);

  if (!visible) {
    return null;
  }

  const cardWidth = Math.min(Math.max(windowWidth - 32, 280), 480);
  const hasContent = Boolean(children);

  return (
    <View style={styles.overlayRoot}>
      <LoggedPressable
        accessibilityLabel={`Dismiss ${title}`}
        logLabel={`Dismiss ${title} backdrop`}
        onPress={onRequestClose}
        style={[styles.backdrop, { backgroundColor: tokens.modalBackdrop }]}
      >
        <View />
      </LoggedPressable>
      <View
        pointerEvents="box-none"
        style={[
          styles.frame,
          {
            paddingBottom: insets.bottom + 18,
            paddingTop: insets.top + 18,
          },
        ]}
      >
        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.headerRow}>
            <View style={styles.copyBlock}>
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle}>{subtitle}</Text>
              ) : null}
            </View>
            <LoggedPressable
              accessibilityLabel={`Close ${title}`}
              logLabel={`Close ${title}`}
              onPress={onRequestClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>{closeLabel}</Text>
            </LoggedPressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
          >
            {hasContent ? children : emptyState}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    card: {
      backgroundColor: tokens.modalSurface,
      borderColor: tokens.border,
      borderRadius: 22,
      borderWidth: 1,
      flexShrink: 1,
      gap: 12,
      maxHeight: '100%',
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    closeButton: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 999,
      justifyContent: 'center',
      minHeight: 34,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    closeButtonText: {
      color: tokens.controlText,
      fontSize: 13,
      fontWeight: '800',
    },
    contentContainer: {
      flexGrow: 1,
      gap: 8,
      paddingBottom: 2,
    },
    copyBlock: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    footer: {
      paddingTop: 2,
    },
    frame: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    headerRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    overlayRoot: {
      ...StyleSheet.absoluteFillObject,
      elevation: 1000,
      zIndex: 1000,
    },
    scrollView: {
      flexShrink: 1,
    },
    subtitle: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    title: {
      color: tokens.textPrimary,
      fontSize: 24,
      fontWeight: '900',
    },
  });
