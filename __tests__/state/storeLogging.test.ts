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
    store.getState().setLogLevel('error');
    store.getState().setParentPin('2468');

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
  });

  it('logs session ui failures as errors and unlocks as debug', () => {
    const store = createSessionUiStore({
      initialParentUnlocked: false,
    });

    expect(store.getState().attemptUnlock('1234', '2468')).toBe(false);
    expect(store.getState().attemptUnlock('2468', '2468')).toBe(true);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Session UI mutation rejected',
      expect.objectContaining({
        action: 'attemptUnlock',
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
