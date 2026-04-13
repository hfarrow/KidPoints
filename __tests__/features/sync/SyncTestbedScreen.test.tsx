import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppSettingsProvider } from '../../../src/features/settings/appSettingsContext';
import { SyncTestbedScreen } from '../../../src/features/sync/SyncTestbedScreen';
import {
  createInitialSharedDocument,
  SharedStoreProvider,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockFileContents = new Map<string, string>();

function setWindowDimensions(width: number, height: number) {
  const setDimensions = ReactNative.Dimensions.set as unknown as (dims: {
    screen: {
      fontScale: number;
      height: number;
      scale: number;
      width: number;
    };
    window: {
      fontScale: number;
      height: number;
      scale: number;
      width: number;
    };
  }) => void;

  setDimensions({
    screen: {
      fontScale: 1,
      height,
      scale: 1,
      width,
    },
    window: {
      fontScale: 1,
      height,
      scale: 1,
      width,
    },
  });
}

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
    navigate: jest.fn(),
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
    Ionicons: MockIcon,
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

function expandScenarioPresets() {
  fireEvent.press(screen.getByLabelText('Expand Scenario Presets'));
}

function pressScenarioPreset(label: string) {
  fireEvent.press(screen.getByLabelText(label));
}

async function waitForPresetCompletion() {
  await waitFor(
    () => expect(screen.queryByText('Running preset automation...')).toBeNull(),
    { timeout: 3_000 },
  );
}

describe('SyncTestbedScreen', () => {
  beforeEach(() => {
    mockFileContents.clear();
    setWindowDimensions(390, 844);
  });

  it('renders controls above the shared sync preview without the route shell', async () => {
    await renderSyncTestbed();

    expect(screen.getByText('Sync Testbed')).toBeTruthy();
    expect(screen.getByText('Testbed Controls')).toBeTruthy();
    expect(screen.getByText('Scenario Presets')).toBeTruthy();
    expect(screen.getByText('Bootstrap Theirs')).toBeTruthy();
    expect(screen.getByText('Bootstrap Mine')).toBeTruthy();
    expect(screen.getByText('Syncing')).toBeTruthy();
    expect(
      screen.getByText(
        'Keep the app open on both phones and hold them back to back.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Manual Remote Steps')).toBeNull();
    expect(
      screen.queryByText(
        'Use fixture controls and visual-state presets to land the live sync preview on the state you want to review without needing a second device.',
      ),
    ).toBeNull();
    expect(screen.queryByText('Instructions')).toBeNull();
    expect(screen.queryByText('Device Sync')).toBeNull();
    expect(screen.getByTestId('sync-testbed-split-body')).toBeTruthy();
    expect(screen.getByTestId('sync-testbed-layout-narrow')).toBeTruthy();
    expect(screen.getByTestId('sync-testbed-controls-scroll')).toBeTruthy();
    expect(screen.getByTestId('sync-testbed-preview-scroll')).toBeTruthy();
  });

  it('switches to the wide split layout on larger screens', async () => {
    setWindowDimensions(1200, 900);

    await renderSyncTestbed();

    expect(screen.getByTestId('sync-testbed-split-body')).toBeTruthy();
    expect(screen.getByTestId('sync-testbed-layout-wide')).toBeTruthy();
    expect(screen.getByTestId('sync-testbed-controls-scroll')).toBeTruthy();
    expect(screen.getByTestId('sync-testbed-preview-scroll')).toBeTruthy();
  });

  it('hides internal sync roles and exposes the simplified visual-state presets', async () => {
    await renderSyncTestbed();

    expect(screen.queryByText('Host')).toBeNull();
    expect(screen.queryByText('Joiner')).toBeNull();
    expect(
      screen.getByText('Fixture: bootstrap-right-to-left. Preset: none.'),
    ).toBeTruthy();
    expect(screen.queryByText('Left Bootstrap')).toBeNull();
    expect(screen.queryByText('Right Bootstrap')).toBeNull();

    expandScenarioPresets();

    expect(screen.getAllByText('Searching').length).toBeGreaterThan(0);
    expect(screen.getByText('Preparing')).toBeTruthy();
    expect(screen.getByText('Review')).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
    expect(screen.getByText('Finishing')).toBeTruthy();
    expect(screen.getByText('Success')).toBeTruthy();
    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(screen.getByText('No NFC')).toBeTruthy();
    expect(screen.getByText('Permissions')).toBeTruthy();
    expect(screen.getByText('NFC Timeout')).toBeTruthy();
    expect(screen.getByText('Wrong Peer')).toBeTruthy();
    expect(screen.getByText('Transfer Failed')).toBeTruthy();
  });

  it('lands the searching preset on the default searching UI', async () => {
    await renderSyncTestbed();

    expandScenarioPresets();

    pressScenarioPreset('Searching');
    await waitFor(
      () =>
        expect(
          screen.getByText(
            'Fixture: bootstrap-right-to-left. Preset: searching.',
          ),
        ).toBeTruthy(),
      { timeout: 3_000 },
    );
    await waitForPresetCompletion();
  });

  it('lands the preparing preset on the preparing UI', async () => {
    await renderSyncTestbed();

    expandScenarioPresets();

    pressScenarioPreset('Preparing');
    await waitFor(
      () =>
        expect(
          screen.getByText(
            'KidPoints is comparing both histories and getting the review ready.',
          ),
        ).toBeTruthy(),
      { timeout: 3_000 },
    );
    await waitForPresetCompletion();
  });

  it('lands the review preset on the review UI', async () => {
    await renderSyncTestbed();

    expandScenarioPresets();

    pressScenarioPreset('Review');
    await waitFor(() => expect(screen.getByText('Review Sync')).toBeTruthy(), {
      timeout: 3_000,
    });
    await waitForPresetCompletion();
  });

  it('lands the waiting preset on the waiting-for-other-phone UI', async () => {
    await renderSyncTestbed();

    expandScenarioPresets();

    pressScenarioPreset('Waiting');
    await waitFor(
      () =>
        expect(
          screen.getAllByText('Waiting For Other Phone').length,
        ).toBeGreaterThan(0),
      { timeout: 3_000 },
    );
    expect(
      screen.getByText(
        'This phone is ready. Confirm on the other phone to finish syncing.',
      ),
    ).toBeTruthy();
    await waitForPresetCompletion();
  });

  it('lands the finishing preset on the finishing UI', async () => {
    await renderSyncTestbed();

    expandScenarioPresets();

    pressScenarioPreset('Finishing');
    await waitFor(
      () =>
        expect(
          screen.getByText('Applying the approved sync on both phones now.'),
        ).toBeTruthy(),
      { timeout: 3_000 },
    );
    expect(screen.getAllByText('Finishing').length).toBeGreaterThan(0);
    await waitForPresetCompletion();
  });

  it('runs the distinct error presets into their user-facing messages', async () => {
    await renderSyncTestbed();

    expandScenarioPresets();

    pressScenarioPreset('Unavailable');
    await waitFor(() =>
      expect(
        screen.getAllByText(
          'Nearby sync is unavailable because Google Play services could not be used on this device.',
        ).length,
      ).toBeGreaterThan(0),
    );

    pressScenarioPreset('No NFC');
    await waitFor(() =>
      expect(
        screen.getAllByText(
          'This device cannot use NFC sync because it has no NFC adapter.',
        ).length,
      ).toBeGreaterThan(0),
    );

    pressScenarioPreset('Permissions');
    await waitFor(() =>
      expect(
        screen.getAllByText(
          'Nearby permissions are needed on this phone before syncing can start.',
        ).length,
      ).toBeGreaterThan(0),
    );

    pressScenarioPreset('NFC Timeout');
    await waitFor(() =>
      expect(
        screen.getAllByText(
          'The phones did not connect in time. Keep them back-to-back and KidPoints can try again.',
        ).length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.getAllByText(
        'KidPoints will keep retrying while this screen stays open.',
      ).length,
    ).toBeGreaterThan(0);

    pressScenarioPreset('Wrong Peer');
    await waitFor(() =>
      expect(
        screen.getAllByText(
          'KidPoints found the wrong phone for this tap. Hold the two syncing phones together and try again.',
        ).length,
      ).toBeGreaterThan(0),
    );

    pressScenarioPreset('Transfer Failed');
    await waitFor(() =>
      expect(
        screen.getAllByText(
          'The phones lost their connection before syncing finished. Hold them together and try again.',
        ).length,
      ).toBeGreaterThan(0),
    );
  });

  it('can open the sandbox preview transaction log after a simulated success', async () => {
    await renderSyncTestbed();

    expandScenarioPresets();
    pressScenarioPreset('Success');

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
