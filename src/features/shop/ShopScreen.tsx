import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { LoggedPressable } from '../../components/LoggedPressable';
import { MainScreenActions } from '../../components/MainScreenActions';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  ActionPillRow,
  CompactSurface,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { createModuleLogger } from '../../logging/logger';
import { selectActiveChildren, useSharedStore } from '../../state/sharedStore';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import {
  buildShopCartSummary,
  formatPointsLabel,
  resolveOrderedShopSkus,
} from './shopModels';
import { useShopUiStore } from './shopUiStore';

const log = createModuleLogger('shop-screen');

function buildImageDataUri(base64: string, mimeType: string) {
  return `data:${mimeType};base64,${base64}`;
}

export function ShopScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const { isParentUnlocked } = useParentSession();
  const activeChildren = useSharedStore(selectActiveChildren);
  const head = useSharedStore((state) => state.document.head);
  const completeShopPurchase = useSharedStore(
    (state) => state.completeShopPurchase,
  );
  const reorderShopSkus = useSharedStore((state) => state.reorderShopSkus);
  const orderedSkus = useMemo(() => resolveOrderedShopSkus(head), [head]);
  const selectedChildId = useShopUiStore((state) => state.selectedChildId);
  const setSelectedChildId = useShopUiStore(
    (state) => state.setSelectedChildId,
  );
  const cartsByChildId = useShopUiStore((state) => state.cartsByChildId);
  const addSkuToCart = useShopUiStore((state) => state.addSkuToCart);
  const decreaseSkuQuantity = useShopUiStore(
    (state) => state.decreaseSkuQuantity,
  );
  const removeSkuFromCart = useShopUiStore((state) => state.removeSkuFromCart);
  const clearCart = useShopUiStore((state) => state.clearCart);
  const isReorderModeEnabled = useShopUiStore(
    (state) => state.isReorderModeEnabled,
  );
  const setReorderModeEnabled = useShopUiStore(
    (state) => state.setReorderModeEnabled,
  );
  const pendingPurchase = useShopUiStore((state) => state.pendingPurchase);
  const queuePendingPurchase = useShopUiStore(
    (state) => state.queuePendingPurchase,
  );
  const clearPendingPurchase = useShopUiStore(
    (state) => state.clearPendingPurchase,
  );
  const selectedChild =
    activeChildren.find((child) => child.id === selectedChildId) ??
    activeChildren[0] ??
    null;
  const cartLines = useMemo(
    () => (selectedChild ? (cartsByChildId[selectedChild.id] ?? []) : []),
    [cartsByChildId, selectedChild],
  );
  const cartSummary = useMemo(
    () =>
      buildShopCartSummary({
        cartLines,
        skusById: head.shop.skusById,
      }),
    [cartLines, head.shop.skusById],
  );
  const remainingPoints = selectedChild
    ? selectedChild.points - cartSummary.totalPointCost
    : 0;

  useEffect(() => {
    log.debug('Shop screen initialized');
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      const stillActive = activeChildren.some(
        (child) => child.id === selectedChildId,
      );

      if (stillActive) {
        return;
      }
    }

    setSelectedChildId(activeChildren[0]?.id ?? null);
  }, [activeChildren, selectedChildId, setSelectedChildId]);

  useEffect(() => {
    if (!pendingPurchase || !isParentUnlocked || pathname !== '/shop') {
      return;
    }

    const result = completeShopPurchase(
      pendingPurchase.childId,
      pendingPurchase.items,
    );

    if (!result.ok) {
      log.warn('Pending shop purchase failed after parent unlock', {
        childId: pendingPurchase.childId,
        error: result.error,
        itemCount: pendingPurchase.items.length,
      });
      clearPendingPurchase();
      return;
    }

    clearCart(pendingPurchase.childId);
    clearPendingPurchase();
  }, [
    clearCart,
    clearPendingPurchase,
    completeShopPurchase,
    isParentUnlocked,
    pathname,
    pendingPurchase,
  ]);

  const openHistory = () => {
    router.navigate('/shop-history');
  };

  const openEditor = (skuId?: string) => {
    if (!isParentUnlocked) {
      router.navigate('/parent-unlock');
      return;
    }

    router.navigate(
      skuId ? `/shop-sku-editor?skuId=${skuId}` : '/shop-sku-editor',
    );
  };

  const submitCheckout = () => {
    if (!selectedChild) {
      return;
    }

    if (cartLines.length === 0) {
      return;
    }

    if (isParentUnlocked) {
      const result = completeShopPurchase(selectedChild.id, cartLines);

      if (result.ok) {
        clearCart(selectedChild.id);
      }
      return;
    }

    queuePendingPurchase({
      childId: selectedChild.id,
      items: cartLines.map((line) => ({ ...line })),
      requestedAt: new Date().toISOString(),
    });
    router.navigate('/parent-unlock');
  };

  return (
    <ScreenScaffold>
      <ScreenHeader
        actions={
          <MainScreenActions
            extraActions={
              <LoggedPressable
                accessibilityLabel="Open Shop Purchase History"
                logLabel="Open Shop Purchase History"
                onPress={openHistory}
                style={styles.headerAction}
              >
                <MaterialCommunityIcons
                  color={tokens.controlText}
                  name="history"
                  size={18}
                />
              </LoggedPressable>
            }
          />
        }
        title="Shop"
        titleIcon={
          <MaterialCommunityIcons
            color={tokens.textPrimary}
            name="shopping-outline"
            size={24}
          />
        }
      />

      <Tile
        accessory={
          selectedChild ? (
            <StatusBadge
              label={formatPointsLabel(selectedChild.points)}
              tone="good"
            />
          ) : null
        }
        title="Shopper"
      >
        {activeChildren.length === 0 ? (
          <Text style={styles.helperCopy}>
            Add a child on Home before using the shop.
          </Text>
        ) : (
          <>
            <Text style={styles.helperCopy}>
              The active cart and point balance belong to one child at a time.
            </Text>
            <View style={styles.childPickerRow}>
              {activeChildren.map((child) => {
                const isSelected = selectedChild?.id === child.id;

                return (
                  <LoggedPressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={child.id}
                    logContext={{ childId: child.id, selected: isSelected }}
                    logLabel={`Select ${child.name} as shop shopper`}
                    onPress={() => setSelectedChildId(child.id)}
                    style={[
                      styles.childPicker,
                      isSelected && styles.childPickerSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.childPickerTitle,
                        isSelected && styles.childPickerTitleSelected,
                      ]}
                    >
                      {child.name}
                    </Text>
                    <Text style={styles.childPickerPoints}>
                      {formatPointsLabel(child.points)}
                    </Text>
                  </LoggedPressable>
                );
              })}
            </View>
          </>
        )}
      </Tile>

      <Tile
        accessory={
          <StatusBadge
            label={
              cartSummary.itemCount === 0
                ? 'Empty'
                : `${cartSummary.itemCount} Item${cartSummary.itemCount === 1 ? '' : 's'}`
            }
            tone={remainingPoints >= 0 ? 'neutral' : 'warning'}
          />
        }
        title="Cart"
      >
        {!selectedChild ? (
          <Text style={styles.helperCopy}>
            Choose a child first to start building a cart.
          </Text>
        ) : cartSummary.items.length === 0 ? (
          <Text style={styles.helperCopy}>
            Add shop items to this child’s cart before checking out.
          </Text>
        ) : (
          <>
            <View style={styles.cartList}>
              {cartSummary.items.map((item) => (
                <CompactSurface key={`${selectedChild.id}-${item.skuId}`}>
                  <View style={styles.cartItemHeader}>
                    <View style={styles.cartItemCopy}>
                      <Text style={styles.cartItemName}>{item.skuName}</Text>
                      <Text style={styles.cartItemMeta}>
                        {formatPointsLabel(item.pointCost)} each
                      </Text>
                    </View>
                    <StatusBadge
                      label={formatPointsLabel(item.lineTotal)}
                      size="mini"
                    />
                  </View>
                  <ActionPillRow>
                    <ActionPill
                      label="-1"
                      onPress={() =>
                        decreaseSkuQuantity(selectedChild.id, item.skuId)
                      }
                    />
                    <ActionPill
                      label="Remove"
                      onPress={() =>
                        removeSkuFromCart(selectedChild.id, item.skuId)
                      }
                    />
                    <ActionPill
                      disableLogging
                      label={`${item.quantity} in cart`}
                    />
                  </ActionPillRow>
                </CompactSurface>
              ))}
            </View>
            <View style={styles.cartTotals}>
              <Text style={styles.cartTotalText}>
                Total: {formatPointsLabel(cartSummary.totalPointCost)}
              </Text>
              <Text
                style={[
                  styles.cartRemainingText,
                  remainingPoints < 0 && styles.cartRemainingWarning,
                ]}
              >
                Remaining: {formatPointsLabel(remainingPoints)}
              </Text>
            </View>
            <ActionPillRow>
              <ActionPill
                label="Clear Cart"
                onPress={() => clearCart(selectedChild.id)}
              />
              <ActionPill
                label={
                  isParentUnlocked ? 'Confirm Purchase' : 'Unlock To Confirm'
                }
                onPress={submitCheckout}
                tone="primary"
              />
            </ActionPillRow>
          </>
        )}
      </Tile>

      <Tile
        accessory={
          <StatusBadge
            label={
              orderedSkus.length === 0
                ? 'Empty'
                : `${orderedSkus.length} SKU${orderedSkus.length === 1 ? '' : 's'}`
            }
          />
        }
        title="Catalog"
      >
        {orderedSkus.length === 0 ? (
          <Text style={styles.helperCopy}>
            Add the first shop item from Parent tools below.
          </Text>
        ) : (
          <View style={styles.catalogList}>
            {orderedSkus.map((sku, index) => (
              <CompactSurface key={sku.id} style={styles.skuCard}>
                <Image
                  source={{
                    uri: buildImageDataUri(
                      sku.image.base64,
                      sku.image.mimeType,
                    ),
                  }}
                  style={styles.skuImage}
                />
                <View style={styles.skuHeader}>
                  <View style={styles.skuCopy}>
                    <Text style={styles.skuTitle}>{sku.name}</Text>
                    <Text style={styles.skuMeta}>
                      {formatPointsLabel(sku.pointCost)}
                    </Text>
                  </View>
                  {selectedChild ? (
                    <StatusBadge
                      label={
                        selectedChild.points >= sku.pointCost
                          ? 'Ready'
                          : 'Over Budget'
                      }
                      size="mini"
                      tone={
                        selectedChild.points >= sku.pointCost
                          ? 'good'
                          : 'warning'
                      }
                    />
                  ) : null}
                </View>
                {isReorderModeEnabled && isParentUnlocked ? (
                  <ActionPillRow>
                    <ActionPill
                      label="Up"
                      onPress={() => {
                        if (index === 0) {
                          return;
                        }

                        const nextOrder = [...head.shop.skuOrder];
                        [nextOrder[index - 1], nextOrder[index]] = [
                          nextOrder[index],
                          nextOrder[index - 1],
                        ];
                        reorderShopSkus(nextOrder);
                      }}
                    />
                    <ActionPill
                      label="Down"
                      onPress={() => {
                        if (index === head.shop.skuOrder.length - 1) {
                          return;
                        }

                        const nextOrder = [...head.shop.skuOrder];
                        [nextOrder[index], nextOrder[index + 1]] = [
                          nextOrder[index + 1],
                          nextOrder[index],
                        ];
                        reorderShopSkus(nextOrder);
                      }}
                    />
                    <ActionPill
                      label="Edit"
                      onPress={() => openEditor(sku.id)}
                    />
                  </ActionPillRow>
                ) : (
                  <ActionPillRow>
                    <ActionPill
                      label="Add To Cart"
                      onPress={() => {
                        if (!selectedChild) {
                          return;
                        }

                        addSkuToCart(selectedChild.id, sku.id);
                      }}
                      tone="primary"
                    />
                    {isParentUnlocked ? (
                      <ActionPill
                        label="Edit"
                        onPress={() => openEditor(sku.id)}
                      />
                    ) : null}
                  </ActionPillRow>
                )}
              </CompactSurface>
            ))}
          </View>
        )}
      </Tile>

      <Tile
        accessory={
          <StatusBadge
            label={isParentUnlocked ? 'Unlocked' : 'Locked'}
            tone={isParentUnlocked ? 'good' : 'warning'}
          />
        }
        title="Parent Tools"
      >
        {isParentUnlocked ? (
          <>
            <Text style={styles.helperCopy}>
              Create items, edit existing cards, and switch into inline reorder
              mode here.
            </Text>
            <ActionPillRow>
              <ActionPill label="Add SKU" onPress={() => openEditor()} />
              <ActionPill
                label={isReorderModeEnabled ? 'Done Reordering' : 'Reorder'}
                onPress={() => setReorderModeEnabled(!isReorderModeEnabled)}
              />
            </ActionPillRow>
          </>
        ) : (
          <ActionPillRow>
            <ActionPill
              label="Unlock with PIN"
              onPress={() => router.navigate('/parent-unlock')}
              tone="primary"
            />
          </ActionPillRow>
        )}
      </Tile>
    </ScreenScaffold>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    cartItemCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    cartItemHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    cartItemMeta: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    cartItemName: {
      color: tokens.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    cartList: {
      gap: 8,
    },
    cartRemainingText: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    cartRemainingWarning: {
      color: tokens.warningText,
    },
    cartTotals: {
      gap: 2,
    },
    cartTotalText: {
      color: tokens.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    catalogList: {
      gap: 8,
    },
    childPicker: {
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      gap: 4,
      minWidth: 120,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    childPickerPoints: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    childPickerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    childPickerSelected: {
      backgroundColor: tokens.accentSoft,
      borderColor: tokens.accent,
    },
    childPickerTitle: {
      color: tokens.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    childPickerTitleSelected: {
      color: tokens.textPrimary,
    },
    headerAction: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    helperCopy: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    skuCard: {
      gap: 10,
    },
    skuCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    skuHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    skuImage: {
      aspectRatio: 4 / 3,
      borderRadius: 14,
      width: '100%',
    },
    skuMeta: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    skuTitle: {
      color: tokens.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
  });
