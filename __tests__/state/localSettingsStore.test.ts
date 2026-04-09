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

  it('rehydrates the persisted active theme id', async () => {
    const storage = createMemoryStorage();
    const firstStore = createLocalSettingsStore({
      initialActiveThemeId: 'default',
      storage,
    });

    firstStore.getState().setActiveThemeId('gruvbox');

    const secondStore = createLocalSettingsStore({
      initialActiveThemeId: 'default',
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().activeThemeId).toBe('gruvbox');
  });

  it('rehydrates the persisted live countdown notification state', async () => {
    const storage = createMemoryStorage();
    const firstStore = createLocalSettingsStore({
      initialLiveCountdownNotificationsEnabled: true,
      storage,
    });

    firstStore.getState().setLiveCountdownNotificationsEnabled(false);

    const secondStore = createLocalSettingsStore({
      initialLiveCountdownNotificationsEnabled: true,
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().liveCountdownNotificationsEnabled).toBe(
      false,
    );
  });

  it('migrates the legacy notificationsEnabled setting into the live countdown toggle', async () => {
    const storage = createMemoryStorage({
      'kidpoints.local-settings.v1': JSON.stringify({
        state: {
          notificationsEnabled: false,
        },
        version: 0,
      }),
    });
    const store = createLocalSettingsStore({
      initialLiveCountdownNotificationsEnabled: true,
      storage,
    });

    await (
      store as typeof store & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(store.getState().liveCountdownNotificationsEnabled).toBe(false);
  });

  it('rehydrates the persisted haptics enabled state', async () => {
    const storage = createMemoryStorage();
    const firstStore = createLocalSettingsStore({
      initialHapticsEnabled: true,
      storage,
    });

    firstStore.getState().setHapticsEnabled(false);

    const secondStore = createLocalSettingsStore({
      initialHapticsEnabled: true,
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().hapticsEnabled).toBe(false);
  });

  it('rehydrates the persisted restart-after-check-in setting', async () => {
    const storage = createMemoryStorage();
    const firstStore = createLocalSettingsStore({
      initialRestartCountdownAfterCheckIn: true,
      storage,
    });

    firstStore.getState().setRestartCountdownAfterCheckIn(false);

    const secondStore = createLocalSettingsStore({
      initialRestartCountdownAfterCheckIn: true,
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().restartCountdownAfterCheckIn).toBe(false);
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

  it('rehydrates persisted namespace color assignments', async () => {
    const storage = createMemoryStorage();
    const firstStore = createLocalSettingsStore({
      storage,
    });

    firstStore.getState().ensureLogNamespaceColors(['alpha', 'beta']);

    const secondStore = createLocalSettingsStore({
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().logNamespaceColors).toEqual({
      alpha: '#2563eb',
      beta: '#dc2626',
    });
  });

  it('resets persisted namespace color assignments', async () => {
    const storage = createMemoryStorage();
    const firstStore = createLocalSettingsStore({
      storage,
    });

    firstStore.getState().ensureLogNamespaceColors(['alpha', 'beta']);
    firstStore.getState().resetLogNamespaceColors();

    const secondStore = createLocalSettingsStore({
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().logNamespaceColors).toEqual({});
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

  it('falls back to empty namespace colors when persisted values are invalid', async () => {
    const storage = createMemoryStorage({
      'kidpoints.local-settings.v1': JSON.stringify({
        state: {
          logNamespaceColors: {
            alpha: '#2563eb',
            beta: 'blue',
            gamma: 42,
          },
        },
        version: 0,
      }),
    });
    const store = createLocalSettingsStore({
      storage,
    });

    await (
      store as typeof store & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(store.getState().logNamespaceColors).toEqual({});
  });

  it('falls back to the default theme when persisted theme ids are invalid', async () => {
    const storage = createMemoryStorage({
      'kidpoints.local-settings.v1': JSON.stringify({
        state: {
          activeThemeId: 'midnight',
        },
        version: 0,
      }),
    });
    const store = createLocalSettingsStore({
      initialActiveThemeId: 'gruvbox',
      storage,
    });

    await (
      store as typeof store & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(store.getState().activeThemeId).toBe('default');
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
