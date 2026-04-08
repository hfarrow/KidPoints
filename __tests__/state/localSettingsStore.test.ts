import { createLocalSettingsStore } from '../../src/state/localSettingsStore';
import { createMemoryStorage } from '../testUtils/memoryStorage';

describe('localSettingsStore', () => {
  it('rehydrates the persisted temp log level in development mode', async () => {
    const storage = createMemoryStorage();
    const firstStore = createLocalSettingsStore({
      allowTemporaryLogLevel: true,
      initialLogLevel: 'debug',
      storage,
    });

    firstStore.getState().setLogLevel('temp');

    const secondStore = createLocalSettingsStore({
      allowTemporaryLogLevel: true,
      initialLogLevel: 'debug',
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().logLevel).toBe('temp');
  });

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

  it('rehydrates the persisted notifications enabled state', async () => {
    const storage = createMemoryStorage();
    const firstStore = createLocalSettingsStore({
      initialNotificationsEnabled: true,
      storage,
    });

    firstStore.getState().setNotificationsEnabled(false);

    const secondStore = createLocalSettingsStore({
      initialNotificationsEnabled: true,
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().notificationsEnabled).toBe(false);
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

  it('normalizes persisted temp log levels outside development mode', async () => {
    const storage = createMemoryStorage();
    const firstStore = createLocalSettingsStore({
      allowTemporaryLogLevel: true,
      initialLogLevel: 'debug',
      storage,
    });

    firstStore.getState().setLogLevel('temp');

    const secondStore = createLocalSettingsStore({
      allowTemporaryLogLevel: false,
      initialLogLevel: 'debug',
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().logLevel).toBe('debug');
  });

  it('falls back safely when persisted log levels are invalid', async () => {
    const storage = createMemoryStorage({
      'kidpoints.local-settings.v1': JSON.stringify({
        state: {
          logLevel: 'verbose',
          parentPin: null,
          themeMode: 'system',
        },
        version: 0,
      }),
    });
    const store = createLocalSettingsStore({
      allowTemporaryLogLevel: false,
      initialLogLevel: 'info',
      storage,
    });

    await (
      store as typeof store & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(store.getState().logLevel).toBe('info');
  });

  it('rehydrates the persisted parent pin', async () => {
    const storage = createMemoryStorage();
    const firstStore = createLocalSettingsStore({
      storage,
    });

    firstStore.getState().setParentPin('2468');

    const secondStore = createLocalSettingsStore({
      initialParentPin: null,
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().parentPin).toBe('2468');
  });
});
