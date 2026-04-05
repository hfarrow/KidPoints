import { StyleSheet, Text } from 'react-native';

import { Tile } from '../../components/Tile';
import { useAppTheme } from '../theme/themeContext';

export function ShopComingSoonTile() {
  const { tokens } = useAppTheme();

  return (
    <Tile eyebrow="Prototype" title="Shop frontend coming next">
      <Text style={[styles.supportingText, { color: tokens.textMuted }]}>
        The catalog and cart architecture are reserved in app state already, but
        this tab is still a placeholder in this phase.
      </Text>
    </Tile>
  );
}

const styles = StyleSheet.create({
  supportingText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
