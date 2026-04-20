import type {
  SharedHead,
  ShopPurchaseItemSnapshot,
  ShopSkuSnapshot,
} from '../../state/sharedTypes';
import type { ShopCartLine } from './shopUiStore';

export type ShopCartSummary = {
  itemCount: number;
  items: ShopPurchaseItemSnapshot[];
  totalPointCost: number;
};

export function formatPointsLabel(points: number) {
  return `${points} Point${points === 1 ? '' : 's'}`;
}

export function resolveOrderedShopSkus(head: SharedHead): ShopSkuSnapshot[] {
  const normalizedOrder = [
    ...head.shop.skuOrder,
    ...Object.keys(head.shop.skusById).filter(
      (skuId) => !head.shop.skuOrder.includes(skuId),
    ),
  ];

  return normalizedOrder
    .map((skuId) => head.shop.skusById[skuId])
    .filter(Boolean);
}

export function buildShopCartSummary(args: {
  cartLines: ShopCartLine[];
  skusById: Record<string, ShopSkuSnapshot>;
}): ShopCartSummary {
  const items: ShopPurchaseItemSnapshot[] = [];

  for (const line of args.cartLines) {
    const sku = args.skusById[line.skuId];

    if (!sku) {
      continue;
    }

    items.push({
      lineTotal: sku.pointCost * line.quantity,
      pointCost: sku.pointCost,
      quantity: line.quantity,
      skuId: sku.id,
      skuName: sku.name,
    });
  }

  return {
    itemCount: items.reduce(
      (currentTotal, item) => currentTotal + item.quantity,
      0,
    ),
    items,
    totalPointCost: items.reduce(
      (currentTotal, item) => currentTotal + item.lineTotal,
      0,
    ),
  };
}
