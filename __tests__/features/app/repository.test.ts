import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { appRepository } from '../../../src/features/app/repository';
import { createDefaultAppData } from '../../../src/features/app/state';
import { createDefaultAppDocument } from '../../../src/features/app/transactions';

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

    expect(loaded.head.uiPreferences.themeMode).toBe('system');
    expect(loaded.transactionState.transactions).toEqual([]);
  });

  it('defaults ui preferences when storage does not include them', async () => {
    mockAsyncStorage.getItem.mockImplementation(async () =>
      JSON.stringify({
        children: [],
        parentSettings: {
          pin: '0000',
        },
      }),
    );

    const loaded = await appRepository.load();

    expect(loaded.head.uiPreferences.themeMode).toBe('system');
  });

  it('migrates legacy snapshot-only storage into a document with empty transactions', async () => {
    mockAsyncStorage.getItem.mockImplementation(async () =>
      JSON.stringify({
        ...createDefaultAppData(),
        children: [
          {
            archivedAt: null,
            avatarColor: '#93c5fd',
            displayName: 'Ava',
            id: 'child-1',
            isArchived: false,
            points: 5,
            sortOrder: 0,
          },
        ],
      }),
    );

    const loaded = await appRepository.load();

    expect(loaded.head.children[0]?.displayName).toBe('Ava');
    expect(loaded.transactionState).toEqual({
      nextTransactionId: 1,
      transactions: [],
    });
  });

  it('persists the selected theme mode', async () => {
    const nextData = createDefaultAppDocument();
    nextData.head = {
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
