import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert, StyleSheet, Text } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

import { LogsScreen } from '../../../src/features/logs/LogsScreen';
import {
  buildLogLevelColorAssignment,
  buildNamespaceTintedTileBackgroundColor,
} from '../../../src/features/logs/namespaceColors';
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

  function renderLogsScreen({
    settingsStorage = createMemoryStorage(),
  }: {
    settingsStorage?: StateStorage;
  } = {}) {
    const renderResult = render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={settingsStorage}
          >
            <LogsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    act(() => {
      resetAppLogBuffer();
    });

    return {
      ...renderResult,
      settingsStorage,
    };
  }

  function getLogTileBackgroundColor(entryId: number) {
    return StyleSheet.flatten(
      screen.getByTestId(`log-tile-${entryId}`).props.style,
    ).backgroundColor;
  }

  function getLevelBadgeBackgroundColor(entryId: number) {
    return StyleSheet.flatten(
      screen.getByTestId(`log-level-badge-${entryId}`).props.style,
    ).backgroundColor;
  }

  function getLevelBadgeTextColor(entryId: number) {
    return StyleSheet.flatten(
      screen.getByTestId(`log-level-badge-${entryId}`).findByType(Text).props
        .style,
    ).color;
  }

  function getLevelBadgeBorderColor(entryId: number) {
    return StyleSheet.flatten(
      screen.getByTestId(`log-level-badge-${entryId}`).props.style,
    ).borderColor;
  }

  function getLevelBadgeBorderWidth(entryId: number) {
    return StyleSheet.flatten(
      screen.getByTestId(`log-level-badge-${entryId}`).props.style,
    ).borderWidth;
  }

  function getLevelBadgeLabel(entryId: number) {
    return screen.getByTestId(`log-level-badge-${entryId}`).findByType(Text)
      .props.children;
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
    expect(screen.getByText('Share Visible Logs')).toBeTruthy();
  });

  it('shows share all logs by default and only shows share visible logs for narrowed filters', () => {
    const alphaLogger = createModuleLogger('alpha');

    renderLogsScreen();

    act(() => {
      alphaLogger.info('Alpha visible log');
    });

    expect(screen.getByText('Share All Logs')).toBeTruthy();
    expect(screen.queryByText('Share Visible Logs')).toBeNull();

    fireEvent.press(screen.getByLabelText('Filter logs at warn and above'));

    expect(screen.getByText('Share Visible Logs')).toBeTruthy();
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
    expect(screen.getByText('Share Visible Logs')).toBeTruthy();
    fireEvent.press(screen.getByText('Share Visible Logs'));

    await waitFor(() => {
      expect(shareBufferedLogsAsync).toHaveBeenCalledWith({
        entries: [
          expect.objectContaining({
            namespace: 'alpha',
            previewText: 'Alpha visible log',
          }),
        ],
        selectedLogLevel: 'temp',
        selectedNamespaceIds: ['alpha'],
      });
    });
  });

  it('shares all logs regardless of active filters', async () => {
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
    fireEvent.press(screen.getByText('Share All Logs'));

    await waitFor(() => {
      expect(shareBufferedLogsAsync).toHaveBeenCalledWith({
        entries: expect.arrayContaining([
          expect.objectContaining({
            namespace: 'alpha',
            previewText: 'Alpha visible log',
          }),
          expect.objectContaining({
            namespace: 'beta',
            previewText: 'Beta hidden log',
          }),
        ]),
        selectedLogLevel: 'all',
        selectedNamespaceIds: [],
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

    fireEvent.press(screen.getByText('Share All Logs'));

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

  it('keeps namespace badge colors stable across rerenders and app settings rehydration', async () => {
    const alphaLogger = createModuleLogger('alpha');
    const betaLogger = createModuleLogger('beta');
    const settingsStorage = createMemoryStorage();
    const firstRender = renderLogsScreen({ settingsStorage });

    act(() => {
      alphaLogger.info('First alpha log');
      betaLogger.info('Beta log');
      alphaLogger.info('Second alpha log');
    });

    const firstAlphaColor = getLogTileBackgroundColor(3);
    const secondAlphaColor = getLogTileBackgroundColor(1);
    const betaColor = getLogTileBackgroundColor(2);

    expect(firstAlphaColor).toBe(secondAlphaColor);
    expect(betaColor).not.toBe(firstAlphaColor);

    firstRender.unmount();

    renderLogsScreen({ settingsStorage });

    act(() => {
      alphaLogger.info('Third alpha log');
      betaLogger.info('Second beta log');
    });

    await waitFor(() => {
      expect(getLogTileBackgroundColor(1)).toBe(firstAlphaColor);
      expect(getLogTileBackgroundColor(2)).toBe(betaColor);
    });
  });

  it('resets persisted namespace colors and reapplies the current buffer order', async () => {
    const alphaLogger = createModuleLogger('alpha');
    const betaLogger = createModuleLogger('beta');
    const settingsStorage = createMemoryStorage({
      'kidpoints.local-settings.v1': JSON.stringify({
        state: {
          logNamespaceColors: {
            alpha: '#9333ea',
            beta: '#2563eb',
          },
        },
        version: 0,
      }),
    });

    renderLogsScreen({ settingsStorage });

    act(() => {
      alphaLogger.info('Alpha log');
      betaLogger.info('Beta log');
    });

    await waitFor(() => {
      expect(getLogTileBackgroundColor(1)).toBe(
        buildNamespaceTintedTileBackgroundColor('#9333ea', '#e3d5fb'),
      );
      expect(getLogTileBackgroundColor(2)).toBe(
        buildNamespaceTintedTileBackgroundColor('#2563eb', '#e3d5fb'),
      );
    });

    fireEvent.press(screen.getByText('Reset Namespace Colors'));

    await waitFor(() => {
      expect(getLogTileBackgroundColor(1)).toBe(
        buildNamespaceTintedTileBackgroundColor('#2563eb', '#e3d5fb'),
      );
      expect(getLogTileBackgroundColor(2)).toBe(
        buildNamespaceTintedTileBackgroundColor('#dc2626', '#e3d5fb'),
      );
    });
  });

  it('colors level badges with console-like tones', () => {
    const logger = createModuleLogger('alpha');
    setAppLogLevel('temp');

    renderLogsScreen();

    act(() => {
      logger.temp('Temp log');
      logger.debug('Debug log');
      logger.info('Info log');
      logger.warn('Warn log');
      logger.error('Error log');
    });

    expect(getLevelBadgeBackgroundColor(1)).toBe(
      buildLogLevelColorAssignment('temp').backgroundColor,
    );
    expect(getLevelBadgeBackgroundColor(2)).toBe(
      buildLogLevelColorAssignment('debug').backgroundColor,
    );
    expect(getLevelBadgeBackgroundColor(3)).toBe(
      buildLogLevelColorAssignment('info').backgroundColor,
    );
    expect(getLevelBadgeBackgroundColor(4)).toBe(
      buildLogLevelColorAssignment('warn').backgroundColor,
    );
    expect(getLevelBadgeBackgroundColor(5)).toBe(
      buildLogLevelColorAssignment('error').backgroundColor,
    );
    expect(getLevelBadgeLabel(1)).toBe('T');
    expect(getLevelBadgeLabel(2)).toBe('D');
    expect(getLevelBadgeLabel(3)).toBe('I');
    expect(getLevelBadgeLabel(4)).toBe('W');
    expect(getLevelBadgeLabel(5)).toBe('E');
    expect(getLevelBadgeBorderColor(3)).toBe('#000000');
    expect(getLevelBadgeBorderWidth(3)).toBe(StyleSheet.hairlineWidth);
    expect(getLevelBadgeTextColor(3)).toBe(
      buildLogLevelColorAssignment('info').textColor,
    );
  });
});
