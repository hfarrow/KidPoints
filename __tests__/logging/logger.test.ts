import {
  appLogger,
  clearCapturedAppLogs,
  createModuleLogger,
  createStructuredLog,
  getAppLogLevel,
  getCapturedAppLogs,
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
    clearCapturedAppLogs();
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

  it('captures warn logs without writing to the Jest terminal output', () => {
    const settingsLogger = createModuleLogger('settings-warn');

    settingsLogger.warn('Saved changes');

    const capturedLogs = getCapturedAppLogs();

    expect(capturedLogs).toHaveLength(1);
    expect(capturedLogs[0]?.consoleMethod).toBe('warn');
    expect(capturedLogs[0]?.level).toBe('warn');
    expect(capturedLogs[0]?.renderedMessage).toContain('settings-warn');
    expect(capturedLogs[0]?.renderedMessage).toContain('[WARN ]');
    expect(capturedLogs[0]?.renderedMessage).toMatch(
      /\[WARN \] \[[^\]]*\.\d{3}[^\]]*\]/,
    );
    expect(capturedLogs[0]?.renderedMessage).toContain('Saved changes');
  });

  it('supports temp logs and colorizes development terminal output', () => {
    const settingsLogger = createModuleLogger('settings-temp');

    setAppLogLevel('temp');
    settingsLogger.temp('Temporary log');

    const capturedLogs = getCapturedAppLogs();

    expect(capturedLogs).toHaveLength(1);
    expect(capturedLogs[0]?.consoleMethod).toBe('log');
    expect(capturedLogs[0]?.level).toBe('temp');
    expect(capturedLogs[0]?.renderedMessage).toContain('settings-temp');
    expect(capturedLogs[0]?.renderedMessage).toContain('[TEMP ]');
    expect(capturedLogs[0]?.renderedMessage).toContain('Temporary log');
    expect(capturedLogs[0]?.renderedMessage).toContain('\u001b[');
    expect(capturedLogs[0]?.renderedMessage.startsWith(' ')).toBe(true);
    expect(capturedLogs[0]?.renderedMessage).toContain('\u001b[38;5;67m');
  });

  it('updates the active root logger severity at runtime', () => {
    setAppLogLevel('error');

    expect(getAppLogLevel()).toBe('error');
  });

  it('filters temp logs when the active severity is debug', () => {
    const settingsLogger = createModuleLogger('settings-temp-filtered');

    setAppLogLevel('debug');
    settingsLogger.temp('Hidden temp log');

    expect(getCapturedAppLogs()).toHaveLength(0);
  });

  it('creates a fixed-message logger that forwards details', () => {
    const settingsLogger = createModuleLogger('settings-structured');
    const logEvent = createStructuredLog(
      settingsLogger,
      'info',
      'Settings event',
    );

    logEvent({ action: 'save' });

    const capturedLogs = getCapturedAppLogs();

    expect(capturedLogs).toHaveLength(1);
    expect(capturedLogs[0]?.consoleMethod).toBe('info');
    expect(capturedLogs[0]?.renderedMessage).toContain('settings-structured');
    expect(capturedLogs[0]?.renderedMessage).toContain('Settings event');
    expect(capturedLogs[0]?.renderedMessage).toContain('save');
  });

  it('forwards native log metadata through the shared logger', () => {
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

    const capturedLogs = getCapturedAppLogs();

    expect(capturedLogs).toHaveLength(1);
    expect(capturedLogs[0]?.consoleMethod).toBe('info');
    expect(capturedLogs[0]?.renderedMessage).toContain('notifications-native');
    expect(capturedLogs[0]?.renderedMessage).toContain('Forwarded native log');
    expect(capturedLogs[0]?.renderedMessage).toContain('notificationId');
    expect(capturedLogs[0]?.renderedMessage).toContain('nativeTimestamp');
    expect(capturedLogs[0]?.renderedMessage).not.toContain('nativeTimestampMs');
    expect(capturedLogs[0]?.renderedMessage).not.toContain('nativeSequence');
    expect(capturedLogs[0]?.renderedMessage).not.toContain('nativeTag');
    expect(capturedLogs[0]?.renderedMessage).toContain('\u001b[38;5;141m');
  });

  it('keeps direct JS logs grayscale while forwarded native logs use purple tones', () => {
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

    const capturedLogs = getCapturedAppLogs();

    expect(capturedLogs).toHaveLength(4);
    expect(capturedLogs[0]?.renderedMessage).toContain('\u001b[38;5;246m');
    expect(capturedLogs[1]?.renderedMessage).toContain('\u001b[38;5;255m');
    expect(capturedLogs[2]?.renderedMessage).toContain('\u001b[38;5;98m');
    expect(capturedLogs[3]?.renderedMessage).toContain('\u001b[38;5;141m');
  });

  it('marks forwarded native logs that arrive out of order with an asterisk timestamp', () => {
    jest.useFakeTimers();
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

    const capturedLogs = getCapturedAppLogs();

    expect(capturedLogs).toHaveLength(2);
    expect(capturedLogs[0]?.renderedMessage).not.toContain('[*');
    expect(capturedLogs[1]?.renderedMessage).toContain('[*');
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
