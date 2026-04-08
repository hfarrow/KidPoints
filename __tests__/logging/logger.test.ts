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
    setAppLogLevel(initialLogLevel);
  });

  afterEach(() => {
    jest.useRealTimers();
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
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('\u001b[38;5;67m');
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

  it('forwards native log metadata through the shared logger', () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const nativeLogger = createModuleLogger('notifications-native');

    logForwardedNativeEntry(
      nativeLogger,
      {
        level: 'info',
        message: 'Forwarded native log',
        sequence: 7,
        tag: 'KidPointsNotifications',
        timestampMs: new Date('2026-04-08T12:34:56.789Z').getTime(),
      },
      { notificationId: 5001 },
    );

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
      'notifications-native',
    );
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
      'Forwarded native log',
    );
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('notificationId');
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('nativeTimestamp');
    expect(String(infoSpy.mock.calls[0]?.[0])).not.toContain(
      'nativeTimestampMs',
    );
    expect(String(infoSpy.mock.calls[0]?.[0])).not.toContain('nativeSequence');
    expect(String(infoSpy.mock.calls[0]?.[0])).not.toContain('nativeTag');
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('\u001b[38;5;141m');
  });

  it('keeps direct JS logs grayscale while forwarded native logs use purple tones', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const jsLogger = createModuleLogger('settings');
    const nativeLogger = createModuleLogger('notifications-native');

    jsLogger.debug('Direct JS debug');
    jsLogger.info('Direct JS info');
    logForwardedNativeEntry(nativeLogger, {
      level: 'debug',
      message: 'Forwarded native debug',
      sequence: 8,
      tag: 'KidPointsNotifications',
      timestampMs: new Date('2026-04-08T12:34:56.789Z').getTime(),
    });
    logForwardedNativeEntry(nativeLogger, {
      level: 'info',
      message: 'Forwarded native info',
      sequence: 9,
      tag: 'KidPointsNotifications',
      timestampMs: new Date('2026-04-08T12:34:56.789Z').getTime(),
    });

    expect(String(logSpy.mock.calls[0]?.[0])).toContain('\u001b[38;5;246m');
    expect(String(logSpy.mock.calls[1]?.[0])).toContain('\u001b[38;5;98m');
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('\u001b[38;5;255m');
    expect(String(infoSpy.mock.calls[1]?.[0])).toContain('\u001b[38;5;141m');
  });

  it('marks forwarded native logs that arrive out of order with an asterisk timestamp', () => {
    jest.useFakeTimers();
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const jsLogger = createModuleLogger('settings-order');
    const nativeLogger = createModuleLogger('notifications-native');

    jest.setSystemTime(new Date('2026-04-08T14:00:10.000Z'));
    jsLogger.info('Direct JS info');

    jest.setSystemTime(new Date('2026-04-08T14:00:11.000Z'));
    logForwardedNativeEntry(nativeLogger, {
      level: 'info',
      message: 'Forwarded native info',
      sequence: 10,
      tag: 'KidPointsNotifications',
      timestampMs: new Date('2026-04-08T14:00:05.000Z').getTime(),
    });

    expect(String(infoSpy.mock.calls[0]?.[0])).not.toContain('[*');
    expect(String(infoSpy.mock.calls[1]?.[0])).toContain('[*');
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
});
