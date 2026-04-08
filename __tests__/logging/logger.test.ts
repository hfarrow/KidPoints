import {
  APP_LOG_BUFFER_LIMIT,
  getAppBufferedLogEntries,
  resetAppLogBuffer,
} from '../../src/logging/logBufferStore';
import {
  appLogger,
  createModuleLogger,
  createStructuredLog,
  getAppLogLevel,
  getDefaultAppLogLevel,
  getSelectableAppLogLevels,
  isAppLogLevel,
  logForwardedNativeEntry,
  normalizeAppLogLevel,
  SUPPORTED_APP_LOG_LEVELS,
  setAppLogLevel,
} from '../../src/logging/logger';

describe('logger', () => {
  const initialLogLevel = getDefaultAppLogLevel();

  beforeEach(() => {
    resetAppLogBuffer();
    setAppLogLevel(initialLogLevel);
  });

  afterEach(() => {
    resetAppLogBuffer();
    setAppLogLevel(initialLogLevel);
    jest.restoreAllMocks();
  });

  it('reuses the same logger for the same namespace', () => {
    const firstLogger = createModuleLogger('settings');
    const secondLogger = createModuleLogger('settings');
    const otherLogger = createModuleLogger('theme');

    expect(secondLogger).toBe(firstLogger);
    expect(otherLogger).not.toBe(firstLogger);
  });

  it('tracks created namespaces on the root logger', () => {
    const settingsNamespace = 'settings-tracking';
    const themeNamespace = 'theme-tracking';

    createModuleLogger(settingsNamespace);
    createModuleLogger(themeNamespace);

    expect(appLogger.getExtensions()).toEqual(
      expect.arrayContaining([settingsNamespace, themeNamespace]),
    );
  });

  it('maps warn logs through console.warn with namespace output', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const settingsLogger = createModuleLogger('settings-warn');

    settingsLogger.warn('Saved changes');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('settings-warn');
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('[WARN ]');
    expect(String(warnSpy.mock.calls[0]?.[0])).toMatch(
      /\[WARN \] \[[^\]]*\.\d{3}[^\]]*\]/,
    );
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('Saved changes');
  });

  it('supports temp logs and colorizes development terminal output', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const settingsLogger = createModuleLogger('settings-temp');

    setAppLogLevel('temp');
    settingsLogger.temp('Temporary log');

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('settings-temp');
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('[TEMP ]');
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('Temporary log');
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('\u001b[');
    expect(String(logSpy.mock.calls[0]?.[0]).startsWith(' ')).toBe(true);
  });

  it('updates the active root logger severity at runtime', () => {
    setAppLogLevel('error');

    expect(getAppLogLevel()).toBe('error');
  });

  it('filters temp logs when the active severity is debug', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const settingsLogger = createModuleLogger('settings-temp-filtered');

    setAppLogLevel('debug');
    settingsLogger.temp('Hidden temp log');

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('creates a fixed-message logger that forwards details', () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const settingsLogger = createModuleLogger('settings-structured');
    const logEvent = createStructuredLog(
      settingsLogger,
      'info',
      'Settings event',
    );

    logEvent({ action: 'save' });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('settings-structured');
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('Settings event');
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('save');
  });

  it('buffers formatted logs with preview and full text', () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const settingsLogger = createModuleLogger('settings-buffered');

    settingsLogger.info('Settings event', {
      action: 'save',
      nested: { changed: true },
    });

    const entries = getAppBufferedLogEntries();

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: 'info',
      namespace: 'settings-buffered',
      previewText: 'Settings event',
    });
    expect(entries[0]?.fullText).toContain('Settings event');
    expect(entries[0]?.fullText).toContain('"changed": true');
  });

  it('forwards native log metadata through the shared logger', () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const nativeLogger = createModuleLogger('notifications-native');

    logForwardedNativeEntry(nativeLogger, {
      level: 'info',
      message: 'Forwarded native log',
      sequence: 7,
      tag: 'KidPointsNotifications',
      timestampMs: new Date('2026-04-08T12:34:56.789Z').getTime(),
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
      'notifications-native',
    );
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
      'Forwarded native log',
    );
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('nativeSequence');
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('nativeTag');
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('nativeTimestampMs');
    expect(getAppBufferedLogEntries()[0]).toMatchObject({
      level: 'info',
      namespace: 'notifications-native',
      previewText: 'Forwarded native log',
    });
  });

  it('validates and normalizes app log levels', () => {
    expect(SUPPORTED_APP_LOG_LEVELS).toContain('temp');
    expect(isAppLogLevel('temp')).toBe(true);
    expect(isAppLogLevel('verbose')).toBe(false);
    expect(
      getSelectableAppLogLevels({ allowTemporaryLogLevel: false }),
    ).toEqual(['debug', 'info', 'warn', 'error']);
    expect(
      normalizeAppLogLevel('temp', { allowTemporaryLogLevel: false }),
    ).toBe(getDefaultAppLogLevel());
    expect(normalizeAppLogLevel('verbose')).toBe(getDefaultAppLogLevel());
  });

  it('keeps only the newest buffered log entries within the memory limit', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const bufferLogger = createModuleLogger('buffer-limit');

    setAppLogLevel('temp');

    for (let index = 0; index < APP_LOG_BUFFER_LIMIT + 5; index += 1) {
      bufferLogger.temp(`Buffered entry ${index}`);
    }

    const entries = getAppBufferedLogEntries();

    expect(logSpy).toHaveBeenCalledTimes(APP_LOG_BUFFER_LIMIT + 5);
    expect(entries).toHaveLength(APP_LOG_BUFFER_LIMIT);
    expect(entries[0]?.previewText).toBe(
      `Buffered entry ${APP_LOG_BUFFER_LIMIT + 4}`,
    );
    expect(entries.at(-1)?.previewText).toBe('Buffered entry 5');
  });
});
