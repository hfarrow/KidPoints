import { fireEvent, render, screen } from '@testing-library/react-native';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppSettingsProvider } from '../../../src/features/settings/appSettingsContext';
import { SettingsScreen } from '../../../src/features/settings/SettingsScreen';
import * as loggerModule from '../../../src/logging/logger';
import {
  createSharedStore,
  SharedStoreProvider,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockBack = jest.fn();
const mockNavigate = jest.fn();
const mockPush = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const mockReactNative = jest.requireActual('react-native');
  const { Text } = mockReactNative;

  function MockIcon() {
    return <Text>icon</Text>;
  }

  return {
    Feather: MockIcon,
    Ionicons: MockIcon,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    navigate: mockNavigate,
    push: mockPush,
  }),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockBack.mockReset();
    mockNavigate.mockReset();
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
          <AppSettingsProvider
            initialParentPin="2468"
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.getByLabelText('Go Back')).toBeTruthy();
    expect(screen.getByText('Unlock')).toBeTruthy();
    expect(
      screen.queryByText(/Parent Mode stays local to this device/i),
    ).toBeNull();
    expect(screen.queryByText('Archived Children')).toBeNull();
    expect(
      screen.getByLabelText('Unlock parent mode for device sync'),
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Unlock'));
    expect(mockNavigate).toHaveBeenCalledWith('/parent-unlock');

    fireEvent.press(screen.getByLabelText('Go Back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows the active theme family and lets you switch to gruvbox', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppSettingsProvider
            initialActiveThemeId="default"
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('KidPoints')).toBeTruthy();
    expect(
      screen.queryByText('Retro warm neutrals with classic Gruvbox contrast.'),
    ).toBeNull();

    fireEvent.press(screen.getByLabelText('Open theme family picker'));

    expect(
      screen.getByText('Retro warm neutrals with classic Gruvbox contrast.'),
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Gruvbox'));

    expect(screen.getByText('Gruvbox')).toBeTruthy();
    expect(
      screen.queryByText('Retro warm neutrals with classic Gruvbox contrast.'),
    ).toBeNull();
  });

  it('shows Lock and Change PIN in the unlocked state', async () => {
    const sharedStorage = createMemoryStorage();

    render(
      <SharedStoreProvider storage={sharedStorage}>
        <ParentSessionProvider initialParentUnlocked>
          <AppSettingsProvider
            initialParentPin="2468"
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Change PIN')).toBeTruthy();

    fireEvent.press(screen.getByText('Change PIN'));
    expect(mockNavigate).toHaveBeenCalledWith('/parent-unlock?mode=change');

    mockNavigate.mockReset();

    fireEvent.press(screen.getByText('Lock'));
    expect(mockNavigate).not.toHaveBeenCalled();

    const transactions = await rehydrateSharedTransactions(sharedStorage);

    expect(transactions.at(-1)?.kind).toBe('parent-mode-locked');
  });

  it('shows and updates the active app log level from the picker modal', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppSettingsProvider
            initialDeveloperModeEnabled={true}
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Log Level')).toBeTruthy();
    expect(screen.getAllByText('debug').length).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        /This setting stays available in release builds so we can raise or reduce logging without a rebuild\./i,
      ),
    ).toBeNull();

    fireEvent.press(screen.getByLabelText('Open log level picker'));

    expect(
      screen.getByText('Temporary debugging detail for active investigation.'),
    ).toBeTruthy();

    fireEvent.press(screen.getByText('error'));

    expect(screen.getAllByText('error').length).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        'Temporary debugging detail for active investigation.',
      ),
    ).toBeNull();
  });

  it('shows and updates the global haptics setting', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppSettingsProvider
            initialHapticsEnabled={true}
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Touch Feedback')).toBeTruthy();
    expect(screen.getAllByText('On')).toHaveLength(1);

    fireEvent(screen.getByLabelText('Enable haptics'), 'valueChange', false);

    expect(screen.getAllByText('Off').length).toBeGreaterThanOrEqual(1);
  });

  it('opens the logs viewer from the debug section', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppSettingsProvider
            initialDeveloperModeEnabled={true}
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    fireEvent.press(screen.getByText('View Logs'));

    expect(mockNavigate).toHaveBeenCalledWith('/logs');
  });

  it('shows the shared sync shortcut in the header', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByLabelText('Open Device Sync')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Open Device Sync'));

    expect(mockNavigate).toHaveBeenCalledWith('/sync');
  });

  it('keeps sync testbed behind developer mode until the toggle is enabled', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppSettingsProvider
            initialDeveloperModeEnabled={false}
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(
      screen.getByText(
        'Show advanced tools like the sync testbed on this device.',
      ),
    ).toBeTruthy();
    expect(screen.getAllByText('Developer Mode').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Off').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Sync Testbed')).toBeNull();
    expect(screen.queryByText('Log Level')).toBeNull();
    expect(screen.queryByText('View Logs')).toBeNull();

    fireEvent(
      screen.getByLabelText('Enable developer mode'),
      'valueChange',
      true,
    );

    expect(screen.getAllByText('On').length).toBeGreaterThan(0);
    expect(screen.getByText('Sync Testbed')).toBeTruthy();
    expect(screen.getByText('Log Level')).toBeTruthy();
    expect(screen.getByText('View Logs')).toBeTruthy();

    fireEvent.press(screen.getByText('Sync Testbed'));

    expect(mockNavigate).toHaveBeenCalledWith('/sync-testbed');
  });

  it('hides the temp option when only production log levels are selectable', () => {
    jest
      .spyOn(loggerModule, 'getSelectableAppLogLevels')
      .mockReturnValue(['debug', 'info', 'warn', 'error']);

    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppSettingsProvider
            initialDeveloperModeEnabled={true}
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.queryByText('temp')).toBeNull();
  });

  it('shows Set PIN when the device has not configured one yet', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <SettingsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    fireEvent.press(screen.getByText('Set PIN'));

    expect(mockNavigate).toHaveBeenCalledWith('/parent-unlock?mode=setup');
  });
});
