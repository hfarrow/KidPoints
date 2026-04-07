import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  CompactSurface,
  SectionLabel,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { useSharedStore } from '../../state/sharedStore';
import { type useAppTheme, useThemedStyles } from '../theme/themeContext';

export function ListBrowserScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const head = useSharedStore((state) => state.document.head);
  const restoreChild = useSharedStore((state) => state.restoreChild);
  const archivedChildren = useMemo(
    () =>
      head.archivedChildIds
        .map((childId) => head.childrenById[childId])
        .filter(Boolean),
    [head],
  );

  return (
    <ScreenScaffold
      footer={<ActionPill label="Back" onPress={() => router.back()} />}
    >
      <ScreenHeader
        eyebrow="Child archive"
        subtitle="Archived children stay out of Home, but their recorded transactions and restore path remain intact."
        title="Archived Children"
      />

      {archivedChildren.length === 0 ? (
        <Tile title="Nothing archived">
          <Text style={styles.emptyCopy}>
            Archived children will appear here once you move them off the Home
            dashboard.
          </Text>
        </Tile>
      ) : (
        <Tile title="Restore children">
          <View style={styles.column}>
            {archivedChildren.map((child) => (
              <CompactSurface key={child.id}>
                <SectionLabel>{child.name}</SectionLabel>
                <Text style={styles.rowText}>{`${child.points} points`}</Text>
                <Text style={styles.metaText}>
                  {child.archivedAt
                    ? `Archived ${new Date(child.archivedAt).toLocaleString()}`
                    : 'Archived child'}
                </Text>
                <ActionPill
                  label="Restore to Home"
                  onPress={() => {
                    restoreChild(child.id);
                  }}
                  tone="primary"
                />
              </CompactSurface>
            ))}
          </View>
        </Tile>
      )}
    </ScreenScaffold>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    column: {
      gap: 8,
    },
    emptyCopy: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    metaText: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    rowText: {
      color: tokens.textPrimary,
      fontSize: 14,
      lineHeight: 20,
    },
  });
