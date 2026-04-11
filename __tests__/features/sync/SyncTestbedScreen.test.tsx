import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppSettingsProvider } from '../../../src/features/settings/appSettingsContext';
import { SyncTestbedScreen } from '../../../src/features/sync/SyncTestbedScreen';
import {
  createInitialSharedDocument,
  SharedStoreProvider,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockFileContents = new Map<string, string>();

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;

    constructor(baseOrUri: string, fileName?: string) {
      this.uri =
        fileName == null
          ? baseOrUri
          : `${baseOrUri.replace(/\/$/, '')}/${fileName}`;
    }

    textSync() {
      return mockFileContents.get(this.uri) ?? '';
    }

    write(contents: string) {
      mockFileContents.set(this.uri, contents);
    }
  }

  return {
    File: MockFile,
    Paths: {
      cache: 'file:///cache',
    },
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
  }),
}));

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

async function renderSyncTestbed() {
  render(
    <SharedStoreProvider
      initialDocument={createInitialSharedDocument({
        deviceId: 'sync-testbed-local',
      })}
      storage={createMemoryStorage()}
    >
      <ParentSessionProvider initialParentUnlocked>
        <AppSettingsProvider
          initialThemeMode="light"
          storage={createMemoryStorage()}
        >
          <SyncTestbedScreen />
        </AppSettingsProvider>
      </ParentSessionProvider>
    </SharedStoreProvider>,
  );

  await act(async () => {
    await Promise.resolve();
  });
}

describe('SyncTestbedScreen', () => {
  beforeEach(() => {
    mockFileContents.clear();
  });

  it('renders controls above the shared sync preview without the route shell', async () => {
    await renderSyncTestbed();

    expect(screen.getByText('Sync Testbed')).toBeTruthy();
    expect(screen.getByText('Testbed Controls')).toBeTruthy();
    expect(screen.getByText('Instructions')).toBeTruthy();
    expect(screen.queryByText('Device Sync')).toBeNull();
  });

  it('hides internal sync roles and runs presets into review and error states', async () => {
    await renderSyncTestbed();

    expect(screen.queryByText('Host')).toBeNull();
    expect(screen.queryByText('Joiner')).toBeNull();
    expect(
      screen.getByText('Fixture: bootstrap-right-to-left. Scenario: manual.'),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Expand Scenario Presets'));
    fireEvent.press(screen.getByText('Happy Review'));
    await waitFor(() => expect(screen.getByText('Review Sync')).toBeTruthy());

    fireEvent.press(screen.getByText('Unavailable'));
    await waitFor(() =>
      expect(
        screen.getAllByText(
          'Nearby sync is unavailable because Google Play services could not be used on this device.',
        ).length,
      ).toBeGreaterThan(0),
    );
  });

  it('can open the sandbox preview transaction log after a simulated success', async () => {
    await renderSyncTestbed();

    fireEvent.press(screen.getByLabelText('Expand Scenario Presets'));
    fireEvent.press(screen.getByText('Happy Success'));

    await waitFor(() => expect(screen.getByText('Sync Complete')).toBeTruthy());

    fireEvent.press(screen.getByText('View Preview History'));

    await waitFor(() =>
      expect(screen.getByText('Preview Transactions')).toBeTruthy(),
    );
    expect(screen.getAllByText('Maya Added').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Maya Set Points [0 > 9]').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Noah Added').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Noah Set Points [0 > 4]').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Applied Device Sync')).toBeTruthy();
  });
});
