import { StyleSheet, Text, View } from 'react-native';

import { Tile } from '../../components/Tile';
import { useAppTheme } from '../theme/themeContext';

type ShopReadySnapshotTileProps = {
  childCount: number;
  isParentUnlocked: boolean;
  shopItemCount: number;
};

export function ShopReadySnapshotTile({
  childCount,
  isParentUnlocked,
  shopItemCount,
}: ShopReadySnapshotTileProps) {
  const { tokens } = useAppTheme();

  return (
    <Tile eyebrow="Snapshot" title="What is already ready">
      <View style={styles.list}>
        <Text style={[styles.listItem, { color: tokens.controlText }]}>
          {`\u2022`} {childCount} child widget{childCount === 1 ? '' : 's'}{' '}
          connected to the shared points system
        </Text>
        <Text style={[styles.listItem, { color: tokens.controlText }]}>
          {`\u2022`} {shopItemCount} shop items in the reserved catalog store
        </Text>
        <Text style={[styles.listItem, { color: tokens.controlText }]}>
          {`\u2022`} Parent mode is{' '}
          {isParentUnlocked ? 'currently unlocked' : 'currently locked'} for
          future catalog management
        </Text>
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  listItem: {
    fontSize: 15,
    lineHeight: 22,
  },
});
