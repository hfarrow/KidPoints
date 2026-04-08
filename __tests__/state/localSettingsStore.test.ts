import { createLocalSettingsStore } from '../../src/state/localSettingsStore';
import { createMemoryStorage } from '../testUtils/memoryStorage';

describe('localSettingsStore', () => {
  it('rehydrates the persisted theme mode', async () => {
    const storage = createMemoryStorage();
    const firstStore = createLocalSettingsStore({
      initialThemeMode: 'system',
      storage,
    });

    firstStore.getState().setThemeMode('dark');

    const secondStore = createLocalSettingsStore({
      initialThemeMode: 'light',
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().themeMode).toBe('dark');
  });

  it('rehydrates the persisted log level', async () => {
    const storage = createMemoryStorage();
    const firstStore = createLocalSettingsStore({
      initialLogLevel: 'info',
      storage,
    });

    firstStore.getState().setLogLevel('error');

    const secondStore = createLocalSettingsStore({
      initialLogLevel: 'debug',
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().logLevel).toBe('error');
  });
});
