import {
  APP_LOG_BUFFER_LIMIT,
  getAppBufferedLogEntries,
  resetAppLogBuffer,
} from '../../src/logging/logBufferStore';
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
    resetAppLogBuffer();
    setAppLogLevel(initialLogLevel);
  });

  afterEach(() => {
    jest.useRealTimers();
    clearCapturedAppLogs();
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
    expect(getAppBufferedLogEntries()).toHaveLength(0);
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

  it('buffers formatted logs with preview and full text', () => {
    const settingsLogger = createModuleLogger('settings-buffered');

    settingsLogger.info('Settings event', {
      action: 'save',
      nested: { changed: true },
    });

    const entries = getAppBufferedLogEntries();

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
    logForwardedNativeEntry(
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
    const bufferedEntries = getAppBufferedLogEntries();

    expect(capturedLogs).toHaveLength(1);
    expect(capturedLogs[0]?.consoleMethod).toBe('info');
    expect(capturedLogs[0]?.renderedMessage).toContain(
      'KidPointsNotifications',
    );
    expect(capturedLogs[0]?.renderedMessage).toContain('Forwarded native log');
    expect(capturedLogs[0]?.renderedMessage).toContain('notificationId');
    expect(capturedLogs[0]?.renderedMessage).toContain('nativeTimestamp');
    expect(capturedLogs[0]?.renderedMessage).toContain('\u001b[38;5;141m');
    expect(bufferedEntries[0]).toMatchObject({
      level: 'info',
      namespace: 'KidPointsNotifications',
      previewText: 'Forwarded native log',
      timestampMs: new Date('2026-04-08T12:34:56.789Z').getTime(),
    });
  });

  it('forwards native temp logs through the shared logger', () => {
    setAppLogLevel('temp');
    logForwardedNativeEntry({
      level: 'temp',
      message: 'Forwarded native temp log',
      sequence: 11,
      tag: 'KidPointsNotifications',
      timestampMs: new Date('2026-04-08T12:34:56.789Z').getTime(),
    });

    const capturedLogs = getCapturedAppLogs();
    const bufferedEntries = getAppBufferedLogEntries();

    expect(capturedLogs).toHaveLength(1);
    expect(capturedLogs[0]?.level).toBe('temp');
    expect(capturedLogs[0]?.renderedMessage).toContain(
      'Forwarded native temp log',
    );
    expect(bufferedEntries[0]).toMatchObject({
      level: 'temp',
      namespace: 'KidPointsNotifications',
      previewText: 'Forwarded native temp log',
    });
  });

  it('keeps direct JS logs grayscale while forwarded native logs use purple tones', () => {
    const jsLogger = createModuleLogger('settings');

    jsLogger.debug('Direct JS debug');
    jsLogger.info('Direct JS info');
    logForwardedNativeEntry({
      level: 'debug',
      message: 'Forwarded native debug',
      sequence: 8,
      tag: 'KidPointsNotifications',
      timestampMs: new Date('2026-04-08T12:34:56.789Z').getTime(),
    });
    logForwardedNativeEntry({
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

    jest.setSystemTime(new Date('2026-04-08T14:00:10.000Z'));
    jsLogger.info('Direct JS info');

    jest.setSystemTime(new Date('2026-04-08T14:00:11.000Z'));
    logForwardedNativeEntry({
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

  it('keeps only the newest buffered log entries within the memory limit', () => {
    const bufferLogger = createModuleLogger('buffer-limit');

    setAppLogLevel('temp');

    for (let index = 0; index < APP_LOG_BUFFER_LIMIT + 5; index += 1) {
      bufferLogger.temp(`Buffered entry ${index}`);
    }

    const entries = getAppBufferedLogEntries();

    expect(entries).toHaveLength(APP_LOG_BUFFER_LIMIT);
    expect(entries[0]?.previewText).toBe(
      `Buffered entry ${APP_LOG_BUFFER_LIMIT + 4}`,
    );
    expect(entries.at(-1)?.previewText).toBe('Buffered entry 5');
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
