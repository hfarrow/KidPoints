import { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ActionList } from '../../components/ActionList';
import {
  ActionPill,
  ActionPillRow,
  CompactSurface,
  SectionLabel,
} from '../../components/Skeleton';
import { useSharedStore } from '../../state/sharedStore';
import { type useAppTheme, useThemedStyles } from '../theme/appTheme';

type ArchivedChildrenOverlayProps = {
  onRequestClose: () => void;
  visible: boolean;
};

export function ArchivedChildrenOverlay({
  onRequestClose,
  visible,
}: ArchivedChildrenOverlayProps) {
  const styles = useThemedStyles(createStyles);
  const head = useSharedStore((state) => state.document.head);
  const deleteChildPermanently = useSharedStore(
    (state) => state.deleteChildPermanently,
  );
  const restoreChild = useSharedStore((state) => state.restoreChild);
  const archivedChildren = useMemo(
    () =>
      head.archivedChildIds
        .map((childId) => head.childrenById[childId])
        .filter(Boolean),
    [head],
  );

  return (
    <ActionList
      closeLabel="Done"
      emptyState={
        <View style={styles.emptyState}>
          <SectionLabel>Nothing Archived</SectionLabel>
          <Text style={styles.emptyCopy}>
            Archived children will appear here once you move them off the Home
            dashboard.
          </Text>
        </View>
      }
      items={archivedChildren}
      keyExtractor={(child) => child.id}
      onRequestClose={onRequestClose}
      renderItem={({ item: child }) => (
        <CompactSurface key={child.id}>
          <SectionLabel>{child.name}</SectionLabel>
          <Text style={styles.rowText}>{`${child.points} points`}</Text>
          <Text style={styles.metaText}>
            {child.archivedAt
              ? `Archived ${new Date(child.archivedAt).toLocaleString()}`
              : 'Archived child'}
          </Text>
          <ActionPillRow>
            <ActionPill
              label="Restore to Home"
              onPress={() => {
                restoreChild(child.id);
              }}
              tone="primary"
            />
            <ActionPill
              label="Delete Permanently"
              onPress={() => {
                Alert.alert(
                  'Delete Child Permanently',
                  `${child.name} will be removed forever. Their archived profile and recorded data will no longer be available after this action.`,
                  [
                    { style: 'cancel', text: 'Cancel' },
                    {
                      onPress: () => {
                        deleteChildPermanently(child.id);
                      },
                      style: 'destructive',
                      text: 'Delete Permanently',
                    },
                  ],
                );
              }}
              tone="critical"
            />
          </ActionPillRow>
        </CompactSurface>
      )}
      subtitle="Restore archived children back to Home or permanently remove them."
      title="Archived Children"
      visible={visible}
    />
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    emptyCopy: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    emptyState: {
      gap: 8,
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
