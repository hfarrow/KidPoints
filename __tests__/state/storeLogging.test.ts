import {
  clearTextInputModal,
  presentTextInputModal,
  useTextInputModalStore,
} from '../../src/features/overlays/textInputModalStore';
import { createLocalSettingsStore } from '../../src/state/localSettingsStore';
import { createSessionUiStore } from '../../src/state/sessionUiStore';
import {
  createInitialSharedDocument,
  createSharedStore,
} from '../../src/state/sharedStore';
import { createMemoryStorage } from '../testUtils/memoryStorage';

jest.mock('../../src/logging/logger', () => {
  const mockLogger = {
    debug: jest.fn(),
    disable: jest.fn(),
    enable: jest.fn(),
    error: jest.fn(),
    extend: jest.fn(),
    getExtensions: jest.fn(),
    getSeverity: jest.fn(),
    info: jest.fn(),
    patchConsole: jest.fn(),
    setSeverity: jest.fn(),
    temp: jest.fn(),
    warn: jest.fn(),
  };

  return {
    __mockLogger: mockLogger,
    appLogger: mockLogger,
    createModuleLogger: jest.fn(() => mockLogger),
    createStructuredLog: jest.fn((loggerInstance, level, message) => {
      return (details = {}) => {
        loggerInstance[level](message, details);
      };
    }),
    getDefaultAppLogLevel: jest.fn(() => 'debug'),
    normalizeAppLogLevel: jest.fn((logLevel, options) => {
      if (logLevel === 'temp' && options?.allowTemporaryLogLevel === false) {
        return options.fallbackLogLevel ?? 'debug';
      }

      return logLevel ?? options?.fallbackLogLevel ?? 'debug';
    }),
  };
});

const { __mockLogger: mockLogger } = jest.requireMock(
  '../../src/logging/logger',
);

describe('store logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTextInputModalStore.setState({ request: null });
  });

  it('logs shared store commits at debug and transactions at info', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-log-a',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Shared store mutation committed',
      expect.objectContaining({
        action: 'addChild',
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Shared transaction committed',
      expect.objectContaining({
        kind: 'child-created',
      }),
    );
  });

  it('logs rejected shared store mutations as errors', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-log-b',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().adjustPoints('missing-child', 1).ok).toBe(false);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Shared store mutation rejected',
      expect.objectContaining({
        action: 'adjustPoints',
        childId: 'missing-child',
      }),
    );
  });

  it('logs local settings mutations as debug', () => {
    const store = createLocalSettingsStore({
      initialThemeMode: 'system',
      storage: createMemoryStorage(),
    });

    store.getState().setThemeMode('dark');
    store.getState().setHapticsEnabled(false);
    store.getState().setLogLevel('error');
    store.getState().ensureLogNamespaceColors(['alpha']);
    store.getState().setParentPin('2468');
    store.getState().resetLogNamespaceColors();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Local settings mutation committed',
      expect.objectContaining({
        action: 'setThemeMode',
        themeMode: 'dark',
      }),
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Local settings mutation committed',
      expect.objectContaining({
        action: 'setHapticsEnabled',
        hapticsEnabled: false,
      }),
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Local settings mutation committed',
      expect.objectContaining({
        action: 'setLogLevel',
        logLevel: 'error',
      }),
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Local settings mutation committed',
      expect.objectContaining({
        action: 'setParentPin',
        hasParentPin: true,
        pinLength: 4,
      }),
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Local settings mutation committed',
      expect.objectContaining({
        action: 'resetLogNamespaceColors',
      }),
    );
  });

  it('logs failed unlock attempts as info and successful unlocks as debug', () => {
    const store = createSessionUiStore({
      initialParentUnlocked: false,
    });

    expect(store.getState().attemptUnlock('1234', '2468')).toBe(false);
    expect(store.getState().attemptUnlock('2468', '2468')).toBe(true);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Parent unlock attempt failed',
      expect.objectContaining({
        action: 'attemptUnlock',
        hasExpectedPin: true,
      }),
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Session UI mutation committed',
      expect.objectContaining({
        action: 'attemptUnlock',
        isParentUnlocked: true,
      }),
    );
  });

  it('logs parent unlock audit transactions through the shared store logger', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-log-parent-audit',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().recordParentUnlockAttempt(false).ok).toBe(true);
    expect(store.getState().recordParentUnlockAttempt(true).ok).toBe(true);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Shared store mutation committed',
      expect.objectContaining({
        action: 'recordParentUnlockAttempt',
        outcome: 'failed',
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Shared transaction committed',
      expect.objectContaining({
        isRestorable: false,
        kind: 'parent-unlock-failed',
        participatesInHistory: false,
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Shared transaction committed',
      expect.objectContaining({
        isRestorable: false,
        kind: 'parent-unlock-succeeded',
        participatesInHistory: false,
      }),
    );
  });

  it('logs parent mode locking audit transactions through the shared store logger', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-log-parent-lock',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().recordParentModeLocked().ok).toBe(true);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Shared store mutation committed',
      expect.objectContaining({
        action: 'recordParentModeLocked',
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Shared transaction committed',
      expect.objectContaining({
        isRestorable: false,
        kind: 'parent-mode-locked',
        participatesInHistory: false,
      }),
    );
  });

  it('logs text input modal state changes as debug', () => {
    presentTextInputModal({
      confirmLabel: 'Save',
      description: 'Edit points',
      inputAccessibilityLabel: 'Value',
      onSubmit: () => ({ ok: true }),
      title: 'Edit Child',
    });
    clearTextInputModal();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Text input modal mutation committed',
      expect.objectContaining({
        action: 'openRequest',
        title: 'Edit Child',
      }),
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Text input modal mutation committed',
      expect.objectContaining({
        action: 'clearRequest',
      }),
    );
  });
});
