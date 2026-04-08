import { fireEvent, render, screen } from '@testing-library/react-native';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { SettingsScreen } from '../../../src/features/settings/SettingsScreen';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import * as loggerModule from '../../../src/logging/logger';
import {
  createSharedStore,
  SharedStoreProvider,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const mockReactNative = jest.requireActual('react-native');
  const { Text } = mockReactNative;

  function MockIcon() {
    return <Text>icon</Text>;
  }

  return {
    Feather: MockIcon,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockBack.mockReset();
    mockPush.mockReset();
  });

  async function rehydrateSharedTransactions(
    storage: ReturnType<typeof createMemoryStorage>,
  ) {
    const store = createSharedStore({ storage });

    await (
      store as typeof store & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    return store.getState().document.transactions;
  }

  it('shows Unlock in the locked state and opens the parent modal', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppThemeProvider
            initialParentPin="2468"
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.getByLabelText('Go Back')).toBeTruthy();
    expect(screen.getByText('Unlock')).toBeTruthy();
    expect(screen.queryByText('Archived Children')).toBeNull();

    fireEvent.press(screen.getByText('Unlock'));
    expect(mockPush).toHaveBeenCalledWith('/parent-unlock');

    fireEvent.press(screen.getByLabelText('Go Back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows Lock and Change PIN in the unlocked state', async () => {
    const sharedStorage = createMemoryStorage();

    render(
      <SharedStoreProvider storage={sharedStorage}>
        <ParentSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialParentPin="2468"
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Change PIN')).toBeTruthy();

    fireEvent.press(screen.getByText('Change PIN'));
    expect(mockPush).toHaveBeenCalledWith('/parent-unlock?mode=change');

    mockPush.mockReset();

    fireEvent.press(screen.getByText('Lock'));
    expect(mockPush).not.toHaveBeenCalled();

    const transactions = await rehydrateSharedTransactions(sharedStorage);

    expect(transactions.at(-1)?.kind).toBe('parent-mode-locked');
  });

  it('shows and updates the active app log level', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Debug')).toBeTruthy();
    expect(screen.getAllByText('debug')).toHaveLength(2);
    expect(screen.getByText('temp')).toBeTruthy();

    fireEvent.press(screen.getByText('temp'));

    expect(screen.getAllByText('temp')).toHaveLength(2);

    fireEvent.press(screen.getByText('error'));

    expect(screen.getAllByText('error')).toHaveLength(2);
  });

  it('opens the logs viewer from the debug section', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    fireEvent.press(screen.getByText('View Logs'));

    expect(mockPush).toHaveBeenCalledWith('/logs');
  });

  it('hides the temp option when only production log levels are selectable', () => {
    jest
      .spyOn(loggerModule, 'getSelectableAppLogLevels')
      .mockReturnValue(['debug', 'info', 'warn', 'error']);

    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.queryByText('temp')).toBeNull();
  });

  it('shows Set PIN when the device has not configured one yet', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    fireEvent.press(screen.getByText('Set PIN'));

    expect(mockPush).toHaveBeenCalledWith('/parent-unlock?mode=setup');
  });
});
