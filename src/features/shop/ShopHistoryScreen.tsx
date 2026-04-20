import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MainScreenActions } from '../../components/MainScreenActions';
import { ScreenBackFooter } from '../../components/ScreenBackFooter';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { StatusBadge } from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { createModuleLogger } from '../../logging/logger';
import { useSharedTransactions } from '../../state/sharedStore';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import { formatPointsLabel } from './shopModels';

const log = createModuleLogger('shop-history-screen');

export function ShopHistoryScreen() {
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const purchaseRows = useSharedTransactions().filter(
    (row) => row.kind === 'shop-purchase-completed',
  );

  useEffect(() => {
    log.debug('Shop history screen initialized');
  }, []);

  return (
    <ScreenScaffold footer={<ScreenBackFooter />}>
      <ScreenHeader
        actions={<MainScreenActions />}
        title="Shop History"
        titleIcon={
          <MaterialCommunityIcons
            color={tokens.textPrimary}
            name="history"
            size={24}
          />
        }
      />

      {purchaseRows.length === 0 ? (
        <Tile title="No Purchases Yet">
          <Text style={styles.emptyCopy}>
            Completed shop purchases will appear here once a cart is checked
            out.
          </Text>
        </Tile>
      ) : (
        <View style={styles.list}>
          {purchaseRows.map((row) => (
            <Tile
              accessory={
                <StatusBadge
                  label={formatPointsLabel(row.shopPurchaseTotalCost ?? 0)}
                  size="mini"
                />
              }
              key={row.id}
              title={row.summaryText}
            >
              <Text style={styles.timestamp}>{row.timestampLabel}</Text>
              <View style={styles.itemList}>
                {(row.shopPurchaseItems ?? []).map((item) => (
                  <View key={`${row.id}-${item.skuId}`} style={styles.itemRow}>
                    <Text style={styles.itemName}>
                      {item.quantity}x {item.skuName}
                    </Text>
                    <Text style={styles.itemCost}>
                      {formatPointsLabel(item.lineTotal)}
                    </Text>
                  </View>
                ))}
              </View>
            </Tile>
          ))}
        </View>
      )}
    </ScreenScaffold>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    emptyCopy: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    itemCost: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    itemList: {
      gap: 6,
    },
    itemName: {
      color: tokens.textPrimary,
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
    },
    itemRow: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    list: {
      gap: 8,
    },
    timestamp: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
  });
