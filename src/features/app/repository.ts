import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadPersistedDocument as loadPersistedDocumentFromNative,
  savePersistedDocument as savePersistedDocumentToNative,
} from './alarmEngine';
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
    const rawValue =
      (await loadPersistedDocumentFromNative()) ??
      (await AsyncStorage.getItem(STORAGE_KEY));

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
          transactionState: document.transactionState,
        } satisfies PersistedAppDocument;
      }

      return {
        version: 5 as const,
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
    const serializedDocument = JSON.stringify(document);

    await savePersistedDocumentToNative(document);
    await AsyncStorage.setItem(STORAGE_KEY, serializedDocument);
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
    timerRuntimeState: {
      ...defaultData.timerRuntimeState,
      ...parsedValue.timerRuntimeState,
    },
    expiredIntervals: Array.isArray(parsedValue.expiredIntervals)
      ? parsedValue.expiredIntervals
      : defaultData.expiredIntervals,
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
