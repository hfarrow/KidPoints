import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { useAppStorage } from '../app/appStorage';
import { useAppTheme } from '../theme/themeContext';
import { ShopComingSoonTile } from './ShopComingSoonTile';
import { ShopReadySnapshotTile } from './ShopReadySnapshotTile';

export function ShopScreen() {
  const { getScreenSurface, tokens } = useAppTheme();
  const { appData, children, parentSession } = useAppStorage();

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safeArea,
        { backgroundColor: getScreenSurface(parentSession.isUnlocked) },
      ]}
    >
      <ScrollView
        contentContainerStyle={[styles.content, tokens.layout.tabScreenContent]}
      >
        <ScreenHeader title="Shop" />

        <ShopComingSoonTile />
        <ShopReadySnapshotTile
          childCount={children.length}
          isParentUnlocked={parentSession.isUnlocked}
          shopItemCount={appData.shopCatalog.items.length}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {},
});
