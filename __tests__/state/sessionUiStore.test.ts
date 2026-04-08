import { createSessionUiStore } from '../../src/state/sessionUiStore';
import { createMemoryStorage } from '../testUtils/memoryStorage';

describe('sessionUiStore', () => {
  it('rehydrates the persisted parent unlock state', async () => {
    const storage = createMemoryStorage();
    const firstStore = createSessionUiStore({
      initialParentUnlocked: false,
      storage,
    });

    firstStore.getState().unlockParentMode();

    const secondStore = createSessionUiStore({
      initialParentUnlocked: false,
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().isParentUnlocked).toBe(true);
  });

  it('rehydrates a locked state after the parent session is locked again', async () => {
    const storage = createMemoryStorage();
    const firstStore = createSessionUiStore({
      initialParentUnlocked: false,
      storage,
    });

    firstStore.getState().unlockParentMode();
    firstStore.getState().lockParentMode();

    const secondStore = createSessionUiStore({
      initialParentUnlocked: true,
      storage,
    });

    await (
      secondStore as typeof secondStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(secondStore.getState().isParentUnlocked).toBe(false);
  });
});
