import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useParentSession } from '../features/parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../features/theme/themeContext';

type ScreenScaffoldProps = PropsWithChildren<{
  footer?: ReactNode;
}>;

export function ScreenScaffold({ children, footer }: ScreenScaffoldProps) {
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked } = useParentSession();
  const { getScreenSurface } = useAppTheme();

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safeArea,
        { backgroundColor: getScreenSurface(isParentUnlocked) },
      ]}
    >
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    content: {
      gap: 10,
      paddingBottom: 16,
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    footer: {
      backgroundColor: tokens.tabBarBackground,
      borderTopColor: tokens.border,
      borderTopWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
  });
