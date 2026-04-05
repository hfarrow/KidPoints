import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppRepository } from './repositoryTypes';
import { createDefaultAppData, DEFAULT_PARENT_PIN } from './state';
import {
  coercePersistedAppDocument,
  createDefaultAppDocument,
  createEmptyTransactionState,
  type PersistedAppDocument,
} from './transactions';
import type { PersistedAppData } from './types';

const STORAGE_KEY = 'kidpoints.app-data.v1';

class AsyncStorageAppRepository implements AppRepository {
  async load() {
    const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return createDefaultAppDocument();
    }

    try {
      const parsedValue = JSON.parse(rawValue) as unknown;
      const document = coercePersistedAppDocument(parsedValue);

      if (document) {
        return {
          ...document,
          head: normalizePersistedAppData(document.head),
          transactionState: {
            nextTransactionId: document.transactionState.nextTransactionId,
            transactions: document.transactionState.transactions,
          },
        } satisfies PersistedAppDocument;
      }

      return {
        version: 3 as const,
        head: normalizePersistedAppData(
          parsedValue as Partial<PersistedAppData>,
        ),
        transactionState: createEmptyTransactionState(),
      };
    } catch {
      return createDefaultAppDocument();
    }
  }

  async save(document: PersistedAppDocument) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  }
}

export const appRepository: AppRepository = new AsyncStorageAppRepository();

function normalizePersistedAppData(parsedValue: Partial<PersistedAppData>) {
  const defaultData = createDefaultAppData();

  return {
    ...defaultData,
    ...parsedValue,
    uiPreferences: {
      ...defaultData.uiPreferences,
      ...parsedValue.uiPreferences,
    },
    parentSettings: {
      ...defaultData.parentSettings,
      ...parsedValue.parentSettings,
      pin:
        parsedValue.parentSettings?.pin === '2468'
          ? DEFAULT_PARENT_PIN
          : (parsedValue.parentSettings?.pin ?? DEFAULT_PARENT_PIN),
    },
    timerConfig: {
      ...defaultData.timerConfig,
      ...parsedValue.timerConfig,
    },
    timerState: {
      ...defaultData.timerState,
      ...parsedValue.timerState,
    },
    shopCatalog: {
      ...defaultData.shopCatalog,
      ...parsedValue.shopCatalog,
    },
    cart: {
      ...defaultData.cart,
      ...parsedValue.cart,
    },
  } satisfies PersistedAppData;
}
