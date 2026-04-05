import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Tile } from '../../components/Tile';
import { useAppTheme } from '../theme/themeContext';

type ParentToolsTileProps = {
  archivedChildrenCount: number;
  onAddChild: () => void;
  onShowArchivedChildren: () => void;
};

export function ParentToolsTile({
  archivedChildrenCount,
  onAddChild,
  onShowArchivedChildren,
}: ParentToolsTileProps) {
  const { tokens } = useAppTheme();

  return (
    <Tile initiallyCollapsed title="Parent Tools">
      <View style={styles.parentToolsActions}>
        <Pressable onPress={onAddChild} style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>Add child widget</Text>
        </Pressable>
        {archivedChildrenCount > 0 ? (
          <Pressable
            onPress={onShowArchivedChildren}
            style={[
              styles.secondaryAction,
              { backgroundColor: tokens.controlSurface },
            ]}
          >
            <Text
              style={[
                styles.secondaryActionText,
                { color: tokens.controlText },
              ]}
            >
              Show archived children
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  parentToolsActions: {
    gap: 10,
  },
  primaryAction: {
    borderRadius: 999,
    backgroundColor: '#0f766e',
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  primaryActionText: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  secondaryAction: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  secondaryActionText: {
    fontWeight: '700',
  },
});
