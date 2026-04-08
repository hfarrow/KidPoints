import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { LogsScreen } from '../../../src/features/logs/LogsScreen';
import { ListPickerModal } from '../../../src/features/overlays/ListPickerModal';
import { clearListPickerModal } from '../../../src/features/overlays/listPickerModalStore';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
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
let mockPathname = '/';

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
  usePathname: () => mockPathname,
  useRouter: () => ({
    back: mockBack,
  }),
}));

describe('LogsScreen', () => {
  beforeEach(() => {
    clearListPickerModal();
    resetAppLogBuffer();
    setAppLogLevel('debug');
    mockBack.mockReset();
    mockPathname = '/';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    clearListPickerModal();
    resetAppLogBuffer();
    jest.restoreAllMocks();
  });

  function renderLogsScreen() {
    const renderResult = render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <LogsScreen />
            <ListPickerModal />
          </AppThemeProvider>
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
    fireEvent.press(screen.getByText('Close'));

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

    fireEvent.press(screen.getByLabelText('Select alpha'));
    fireEvent.press(screen.getByText('Close'));

    expect(screen.getByText('Alpha error log')).toBeTruthy();
    expect(screen.queryByText('Beta warn log')).toBeNull();
    expect(screen.getByText('1 On')).toBeTruthy();
  });
});
