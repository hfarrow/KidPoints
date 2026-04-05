import { Pressable, StyleSheet, Text } from 'react-native';

import { Tile } from '../../components/Tile';
import { useAppTheme } from '../theme/themeContext';

type EmptyChildrenTileProps = {
  isParentUnlocked: boolean;
  onAddChild: () => void;
};

export function EmptyChildrenTile({
  isParentUnlocked,
  onAddChild,
}: EmptyChildrenTileProps) {
  const { tokens } = useAppTheme();

  return (
    <Tile title="No child widgets yet">
      <Text style={[styles.supportingText, { color: tokens.textMuted }]}>
        Unlock Parent Mode to add the first child widget to this shared
        dashboard.
      </Text>
      {isParentUnlocked ? (
        <Pressable onPress={onAddChild} style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>Add a child</Text>
        </Pressable>
      ) : null}
    </Tile>
  );
}

const styles = StyleSheet.create({
  supportingText: {
    fontSize: 15,
    lineHeight: 22,
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
});
