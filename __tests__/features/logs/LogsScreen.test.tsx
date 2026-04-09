import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';

import { LogsScreen } from '../../../src/features/logs/LogsScreen';
import { shareBufferedLogsAsync } from '../../../src/features/logs/shareLogs';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppSettingsProvider } from '../../../src/features/settings/appSettingsContext';
import {
  getAppBufferedLogEntries,
  resetAppLogBuffer,
} from '../../../src/logging/logBufferStore';
import {
  createModuleLogger,
  setAppLogLevel,
} from '../../../src/logging/logger';
import { SharedStoreProvider } from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockBack = jest.fn();

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
  }),
}));

jest.mock('../../../src/features/logs/shareLogs', () => ({
  shareBufferedLogsAsync: jest.fn(),
}));

describe('LogsScreen', () => {
  beforeEach(() => {
    resetAppLogBuffer();
    setAppLogLevel('debug');
    mockBack.mockReset();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(shareBufferedLogsAsync).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    resetAppLogBuffer();
    jest.restoreAllMocks();
  });

  function renderLogsScreen() {
    const renderResult = render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <LogsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    act(() => {
      resetAppLogBuffer();
    });

    return renderResult;
  }

  it('shows an empty state before any logs are buffered', () => {
    renderLogsScreen();

    expect(screen.getByText('No Logs Yet')).toBeTruthy();
    expect(
      screen.getByText(
        'Logs written through the shared app logger will appear here during this app session.',
      ),
    ).toBeTruthy();
  });

  it('shows newest logs first and expands full multiline content on demand', () => {
    const alphaLogger = createModuleLogger('alpha');
    const betaLogger = createModuleLogger('beta');

    renderLogsScreen();

    act(() => {
      alphaLogger.info('First alpha log');
      betaLogger.warn('Second beta log', {
        nested: { value: 2 },
      });
      alphaLogger.debug('Third alpha log');
    });

    expect(screen.getByTestId('log-summary-0').props.children).toBe(
      'Third alpha log',
    );
    expect(screen.getByTestId('log-summary-1').props.children).toBe(
      'Second beta log',
    );
    expect(screen.queryByText(/\[DEBUG\].*Third alpha log/u)).toBeNull();

    fireEvent.press(screen.getByLabelText('Expand Third alpha log'));

    expect(screen.getByText(/\[DEBUG\].*Third alpha log/u)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Expand Second beta log'));
    expect(screen.getByText(/"value": 2/u)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Go Back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('does not create new log entries while interacting with the viewer', () => {
    const alphaLogger = createModuleLogger('alpha');

    renderLogsScreen();

    act(() => {
      alphaLogger.info('Stable alpha log');
    });

    const logCountBeforeInteractions = getAppBufferedLogEntries().length;

    fireEvent.press(screen.getByLabelText('Expand Stable alpha log'));
    fireEvent.press(screen.getByLabelText('Filter logs at info and above'));
    fireEvent.press(screen.getByLabelText('Choose namespace filter'));
    fireEvent.press(screen.getByLabelText('Select alpha'));
    fireEvent.press(screen.getByLabelText('Close Filter Namespaces'));

    expect(getAppBufferedLogEntries()).toHaveLength(logCountBeforeInteractions);
  });

  it('filters logs by threshold level and by selected namespace', () => {
    const alphaLogger = createModuleLogger('alpha');
    const betaLogger = createModuleLogger('beta');

    renderLogsScreen();

    act(() => {
      alphaLogger.debug('Alpha debug log');
      betaLogger.warn('Beta warn log');
      alphaLogger.error('Alpha error log');
    });

    fireEvent.press(screen.getByLabelText('Filter logs at warn and above'));

    expect(screen.getByText('Alpha error log')).toBeTruthy();
    expect(screen.getByText('Beta warn log')).toBeTruthy();
    expect(screen.queryByText('Alpha debug log')).toBeNull();

    fireEvent.press(screen.getByLabelText('Choose namespace filter'));
    expect(screen.getByText('Filter Namespaces')).toBeTruthy();
    expect(
      screen.getByText(
        'Choose which logger namespaces stay visible in the log viewer.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Select alpha'));
    expect(screen.getByLabelText('Selected alpha')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Dismiss Filter Namespaces'));

    expect(screen.getByText('Alpha error log')).toBeTruthy();
    expect(screen.queryByText('Beta warn log')).toBeNull();
    expect(screen.getByText('1 On')).toBeTruthy();
  });

  it('shares the currently visible logs', async () => {
    const alphaLogger = createModuleLogger('alpha');
    const betaLogger = createModuleLogger('beta');

    renderLogsScreen();

    act(() => {
      alphaLogger.info('Alpha visible log');
      betaLogger.warn('Beta hidden log');
    });

    fireEvent.press(screen.getByLabelText('Choose namespace filter'));
    fireEvent.press(screen.getByLabelText('Select alpha'));
    fireEvent.press(screen.getByLabelText('Close Filter Namespaces'));
    fireEvent.press(screen.getByText('Share Visible Logs'));

    await waitFor(() => {
      expect(shareBufferedLogsAsync).toHaveBeenCalledWith({
        entries: [
          expect.objectContaining({
            namespace: 'alpha',
            previewText: 'Alpha visible log',
          }),
        ],
        selectedLogLevel: 'all',
        selectedNamespaceIds: ['alpha'],
      });
    });
  });

  it('shows an alert when sharing is unavailable', async () => {
    const alphaLogger = createModuleLogger('alpha');

    jest.mocked(shareBufferedLogsAsync).mockResolvedValue({
      ok: false,
      reason: 'sharing-unavailable',
    });

    renderLogsScreen();

    act(() => {
      alphaLogger.info('Alpha visible log');
    });

    fireEvent.press(screen.getByText('Share Visible Logs'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Sharing Unavailable',
        'This device does not currently support sharing exported log files.',
      );
    });
  });

  it('shows an empty namespace overlay state before any namespaced logs are buffered', () => {
    renderLogsScreen();

    fireEvent.press(screen.getByLabelText('Choose namespace filter'));

    expect(screen.getByText('Filter Namespaces')).toBeTruthy();
    expect(
      screen.getByText(
        'Namespace filters will appear here after logs with namespaces have been buffered in this app session.',
      ),
    ).toBeTruthy();
  });
});
