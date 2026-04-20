import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
} from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { createModuleLogger, createStructuredLog } from '../../logging/logger';
import { useStableStoreReference } from '../../state/useStableStoreReference';

export type ShopCartLine = {
  quantity: number;
  skuId: string;
};

export type PendingShopPurchase = {
  childId: string;
  items: ShopCartLine[];
  requestedAt: string;
};

type ShopUiState = {
  addSkuToCart: (childId: string, skuId: string) => void;
  cartsByChildId: Record<string, ShopCartLine[]>;
  clearCart: (childId: string) => void;
  clearPendingPurchase: () => void;
  decreaseSkuQuantity: (childId: string, skuId: string) => void;
  isReorderModeEnabled: boolean;
  pendingPurchase: PendingShopPurchase | null;
  queuePendingPurchase: (purchase: PendingShopPurchase) => void;
  removeSkuFromCart: (childId: string, skuId: string) => void;
  selectedChildId: string | null;
  setReorderModeEnabled: (enabled: boolean) => void;
  setSelectedChildId: (childId: string | null) => void;
};

type ShopUiStore = StoreApi<ShopUiState>;

const SHOP_UI_STORE_BUILD_TOKEN = Symbol('shop-ui-store-build');
const log = createModuleLogger('shop-ui-store');
const logShopUiMutation = createStructuredLog(
  log,
  'debug',
  'Shop UI mutation committed',
);

const ShopUiStoreContext = createContext<ShopUiStore | null>(null);

function upsertCartLine(lines: ShopCartLine[], skuId: string) {
  const existingLine = lines.find((line) => line.skuId === skuId);

  if (!existingLine) {
    return [...lines, { quantity: 1, skuId }];
  }

  return lines.map((line) =>
    line.skuId === skuId ? { ...line, quantity: line.quantity + 1 } : line,
  );
}

function decreaseCartLine(lines: ShopCartLine[], skuId: string) {
  return lines.flatMap((line) => {
    if (line.skuId !== skuId) {
      return [line];
    }

    if (line.quantity <= 1) {
      return [];
    }

    return [{ ...line, quantity: line.quantity - 1 }];
  });
}

export function createShopUiStore() {
  return createStore<ShopUiState>()((set) => ({
    addSkuToCart: (childId, skuId) => {
      logShopUiMutation({
        action: 'addSkuToCart',
        childId,
        skuId,
      });
      set((state) => ({
        cartsByChildId: {
          ...state.cartsByChildId,
          [childId]: upsertCartLine(state.cartsByChildId[childId] ?? [], skuId),
        },
      }));
    },
    cartsByChildId: {},
    clearCart: (childId) => {
      logShopUiMutation({
        action: 'clearCart',
        childId,
      });
      set((state) => ({
        cartsByChildId: {
          ...state.cartsByChildId,
          [childId]: [],
        },
      }));
    },
    clearPendingPurchase: () => {
      logShopUiMutation({
        action: 'clearPendingPurchase',
      });
      set({ pendingPurchase: null });
    },
    decreaseSkuQuantity: (childId, skuId) => {
      logShopUiMutation({
        action: 'decreaseSkuQuantity',
        childId,
        skuId,
      });
      set((state) => ({
        cartsByChildId: {
          ...state.cartsByChildId,
          [childId]: decreaseCartLine(
            state.cartsByChildId[childId] ?? [],
            skuId,
          ),
        },
      }));
    },
    isReorderModeEnabled: false,
    pendingPurchase: null,
    queuePendingPurchase: (purchase) => {
      logShopUiMutation({
        action: 'queuePendingPurchase',
        childId: purchase.childId,
        itemCount: purchase.items.length,
      });
      set({
        pendingPurchase: {
          childId: purchase.childId,
          items: purchase.items.map((item) => ({ ...item })),
          requestedAt: purchase.requestedAt,
        },
      });
    },
    removeSkuFromCart: (childId, skuId) => {
      logShopUiMutation({
        action: 'removeSkuFromCart',
        childId,
        skuId,
      });
      set((state) => ({
        cartsByChildId: {
          ...state.cartsByChildId,
          [childId]: (state.cartsByChildId[childId] ?? []).filter(
            (line) => line.skuId !== skuId,
          ),
        },
      }));
    },
    selectedChildId: null,
    setReorderModeEnabled: (enabled) => {
      logShopUiMutation({
        action: 'setReorderModeEnabled',
        enabled,
      });
      set({ isReorderModeEnabled: enabled });
    },
    setSelectedChildId: (childId) => {
      logShopUiMutation({
        action: 'setSelectedChildId',
        childId,
      });
      set({ selectedChildId: childId });
    },
  }));
}

export function ShopUiStoreProvider({ children }: PropsWithChildren) {
  const store = useStableStoreReference(() => createShopUiStore(), {
    devRefreshToken: SHOP_UI_STORE_BUILD_TOKEN,
  });

  useEffect(() => {
    log.info('Shop UI store provider initialized');
  }, []);

  return (
    <ShopUiStoreContext.Provider value={store}>
      {children}
    </ShopUiStoreContext.Provider>
  );
}

export function useShopUiStore<T>(selector: (state: ShopUiState) => T) {
  const store = useContext(ShopUiStoreContext);

  if (!store) {
    throw new Error('useShopUiStore must be used within ShopUiStoreProvider');
  }

  return useStore(store, selector);
}
