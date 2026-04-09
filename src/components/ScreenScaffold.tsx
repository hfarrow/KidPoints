import type { PropsWithChildren, ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useParentSession } from '../features/parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../features/theme/appTheme';

type ScreenScaffoldProps = PropsWithChildren<{
  footer?: ReactNode;
  scrollViewRef?: RefObject<ScrollView | null>;
}>;

export function ScreenScaffold({
  children,
  footer,
  scrollViewRef,
}: ScreenScaffoldProps) {
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked } = useParentSession();
  const { getScreenSurface } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: getScreenSurface(isParentUnlocked) },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 8,
          },
        ]}
        ref={scrollViewRef}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 10,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      gap: 10,
      paddingBottom: 16,
      paddingHorizontal: 12,
    },
    footer: {
      backgroundColor: tokens.tabBarBackground,
      borderTopColor: tokens.border,
      borderTopWidth: 1,
      paddingHorizontal: 14,
      paddingTop: 10,
    },
  });
