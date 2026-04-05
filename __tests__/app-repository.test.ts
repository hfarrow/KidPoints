import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { appRepository } from '../src/features/app/repository';
import { createDefaultAppData } from '../src/features/app/state';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockAsyncStorage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

describe('appRepository', () => {
  beforeEach(() => {
    mockAsyncStorage.getItem.mockReset();
    mockAsyncStorage.setItem.mockReset();
  });

  it('defaults the theme preference to system when storage is empty', async () => {
    mockAsyncStorage.getItem.mockImplementation(async () => null);

    const loaded = await appRepository.load();

    expect(loaded.uiPreferences.themeMode).toBe('system');
  });

  it('hydrates older saved data that does not include ui preferences', async () => {
    mockAsyncStorage.getItem.mockImplementation(async () =>
      JSON.stringify({
        children: [],
        parentSettings: {
          pin: '0000',
        },
      }),
    );

    const loaded = await appRepository.load();

    expect(loaded.uiPreferences.themeMode).toBe('system');
  });

  it('persists the selected theme mode', async () => {
    const nextData = {
      ...createDefaultAppData(),
      uiPreferences: {
        themeMode: 'dark' as const,
      },
    };

    mockAsyncStorage.setItem.mockImplementation(async () => null);

    await appRepository.save(nextData);

    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      'kidpoints.app-data.v1',
      expect.stringContaining('"themeMode":"dark"'),
    );
  });
});
