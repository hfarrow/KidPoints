import {
  appLogger,
  createModuleLogger,
  getAppLogLevel,
  getDefaultAppLogLevel,
  setAppLogLevel,
} from '../../src/logging/logger';

describe('logger', () => {
  const initialLogLevel = getDefaultAppLogLevel();

  beforeEach(() => {
    setAppLogLevel(initialLogLevel);
  });

  afterEach(() => {
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
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('WARN');
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('Saved changes');
  });

  it('updates the active root logger severity at runtime', () => {
    setAppLogLevel('error');

    expect(getAppLogLevel()).toBe('error');
  });
});
