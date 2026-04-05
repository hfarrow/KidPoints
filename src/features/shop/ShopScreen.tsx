import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Tile } from '../../components/Tile';
import { useAppStorage } from '../app/appStorage';
import { useAppTheme } from '../theme/themeContext';

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
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Shop"
          subtitle="The family reward shop will live here, backed by persistent catalog data and future checkout flows."
        />

        <Tile eyebrow="Prototype" title="Shop frontend coming next">
          <Text style={[styles.supportingText, { color: tokens.textMuted }]}>
            The catalog and cart architecture are reserved in app state already,
            but this tab is still a placeholder in this phase.
          </Text>
        </Tile>

        <Tile eyebrow="Snapshot" title="What is already ready">
          <View style={styles.list}>
            <Text style={[styles.listItem, { color: tokens.controlText }]}>
              {`\u2022`} {children.length} child widget
              {children.length === 1 ? '' : 's'} connected to the shared points
              system
            </Text>
            <Text style={[styles.listItem, { color: tokens.controlText }]}>
              {`\u2022`} {appData.shopCatalog.items.length} shop items in the
              reserved catalog store
            </Text>
            <Text style={[styles.listItem, { color: tokens.controlText }]}>
              {`\u2022`} Parent mode is{' '}
              {parentSession.isUnlocked
                ? 'currently unlocked'
                : 'currently locked'}{' '}
              for future catalog management
            </Text>
          </View>
        </Tile>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    paddingTop: 12,
    gap: 16,
  },
  supportingText: {
    fontSize: 15,
    lineHeight: 22,
  },
  list: {
    gap: 10,
  },
  listItem: {
    fontSize: 15,
    lineHeight: 22,
  },
});
