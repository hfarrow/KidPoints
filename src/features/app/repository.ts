import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppRepository, PersistedAppData } from './repositoryTypes';
import { createDefaultAppData, DEFAULT_PARENT_PIN } from './state';

const STORAGE_KEY = 'kidpoints.app-data.v1';

class AsyncStorageAppRepository implements AppRepository {
  async load() {
    const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return createDefaultAppData();
    }

    try {
      const parsedValue = JSON.parse(rawValue) as Partial<PersistedAppData>;
      const defaultData = createDefaultAppData();

      return {
        ...defaultData,
        ...parsedValue,
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
    } catch {
      return createDefaultAppData();
    }
  }

  async save(data: PersistedAppData) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export const appRepository: AppRepository = new AsyncStorageAppRepository();
