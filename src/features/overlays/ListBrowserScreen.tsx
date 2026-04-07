import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  CompactSurface,
  SectionLabel,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { type useAppTheme, useThemedStyles } from '../theme/themeContext';

export function ListBrowserScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);

  return (
    <ScreenScaffold
      footer={<ActionPill label="Close" onPress={() => router.back()} />}
    >
      <ScreenHeader
        eyebrow="List overlay"
        subtitle="A lightweight routed browsing surface for archived items, future history, or short review tasks."
        title="List browser"
      />

      <Tile title="Compact rows">
        <View style={styles.column}>
          {['Archived children', 'Recent check-ins', 'Reward drafts'].map(
            (row) => (
              <CompactSurface key={row}>
                <SectionLabel>{row}</SectionLabel>
                <Text style={styles.rowText}>
                  Visual shell only. Real data and actions arrive in a later
                  step.
                </Text>
              </CompactSurface>
            ),
          )}
        </View>
      </Tile>
    </ScreenScaffold>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    column: {
      gap: 8,
    },
    rowText: {
      color: tokens.textPrimary,
      fontSize: 14,
      lineHeight: 20,
    },
  });
