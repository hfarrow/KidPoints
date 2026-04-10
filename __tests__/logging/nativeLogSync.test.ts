import type { AppLogger } from '../../src/logging/logger';
import {
  connectNativeLogReceiver,
  createNativeLogReplayController,
  type NativeLogEntry,
  parseBufferedNativeLogEntries,
  parseNativeLogEntry,
} from '../../src/logging/nativeLogSync';

jest.mock('../../src/logging/logger', () => {
  const actualLoggerModule = jest.requireActual('../../src/logging/logger');

  return {
    ...actualLoggerModule,
    logForwardedNativeEntry: jest.fn(),
  };
});

const { logForwardedNativeEntry: mockLogForwardedNativeEntry } =
  jest.requireMock('../../src/logging/logger') as {
    logForwardedNativeEntry: jest.Mock;
  };

function createMockLogger() {
  return {
    warn: jest.fn(),
  } as unknown as AppLogger;
}

describe('nativeLogSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses valid native log entries and normalizes unknown levels', () => {
    expect(
      parseNativeLogEntry({
        contextJson: '{"source":"native"}',
        level: 'mystery',
        message: 'Native message',
        sequence: 3,
        tag: 'KidPointsNative',
        timestampMs: 123,
      }),
    ).toEqual({
      contextJson: '{"source":"native"}',
      level: 'debug',
      message: 'Native message',
      sequence: 3,
      tag: 'KidPointsNative',
      timestampMs: 123,
    });
  });

  it('rejects invalid buffered payloads', () => {
    const logger = createMockLogger();

    expect(
      parseBufferedNativeLogEntries({
        logEntriesJson: '{"not":"an-array"}',
        logger,
        sourceLabel: 'test native logs',
      }),
    ).toEqual([]);
    expect((logger.warn as jest.Mock).mock.calls).toEqual([
      [
        'Ignored test native logs buffered native logs payload',
        { reason: 'not-an-array' },
      ],
    ]);
  });

  it('replays buffered entries first, then queued live entries, and suppresses duplicates', () => {
    const forwarded: number[] = [];
    let lastSeenSequence = 1;
    const replayController = createNativeLogReplayController({
      getLastSeenSequence: () => lastSeenSequence,
      onForward: (entry) => {
        forwarded.push(entry.sequence);
      },
      setLastSeenSequence: (sequence) => {
        lastSeenSequence = sequence;
      },
    });

    replayController.handleLiveEntry({
      contextJson: null,
      level: 'info',
      message: 'live later',
      sequence: 5,
      tag: 'KidPointsNative',
      timestampMs: 5,
    });
    replayController.handleLiveEntry({
      contextJson: null,
      level: 'info',
      message: 'live duplicate',
      sequence: 2,
      tag: 'KidPointsNative',
      timestampMs: 2,
    });

    replayController.replayBufferedEntries([
      {
        contextJson: null,
        level: 'info',
        message: 'buffered newer',
        sequence: 4,
        tag: 'KidPointsNative',
        timestampMs: 4,
      },
      {
        contextJson: null,
        level: 'info',
        message: 'buffered older',
        sequence: 2,
        tag: 'KidPointsNative',
        timestampMs: 2,
      },
    ]);

    replayController.handleLiveEntry({
      contextJson: null,
      level: 'info',
      message: 'live newest',
      sequence: 6,
      tag: 'KidPointsNative',
      timestampMs: 6,
    });

    expect(forwarded).toEqual([2, 4, 5, 6]);
  });

  it('connects a shared native log receiver that forwards tag-driven entries with parsed context', () => {
    let lastSeenSequence = -1;
    let didCaptureLiveListener = false;
    let liveListener = (_entry: NativeLogEntry) => {};
    const removeSubscription = jest.fn();

    const disconnect = connectNativeLogReceiver<NativeLogEntry>({
      addLogListener: (listener) => {
        didCaptureLiveListener = true;
        liveListener = listener;
        listener({
          contextJson: '{"source":"live-new"}',
          level: 'info',
          message: 'live queued',
          sequence: 3,
          tag: 'KidPointsNotificationsIntent',
          timestampMs: 300,
        });
        listener({
          contextJson: '{"source":"live-duplicate"}',
          level: 'warn',
          message: 'live duplicate',
          sequence: 2,
          tag: 'KidPointsNotificationsIntent',
          timestampMs: 250,
        });

        return { remove: removeSubscription };
      },
      getBufferedEntries: (): NativeLogEntry[] => [
        {
          contextJson: '{"source":"buffer-second"}',
          level: 'warn',
          message: 'buffered second',
          sequence: 2,
          tag: 'KidPointsNotificationsIntent',
          timestampMs: 200,
        },
        {
          contextJson: '{"source":"buffer-first"}',
          level: 'debug',
          message: 'buffered first',
          sequence: 1,
          tag: 'KidPointsNotifications',
          timestampMs: 100,
        },
      ],
      getLastSeenSequence: () => lastSeenSequence,
      parseContextJson: (contextJson) =>
        contextJson ? (JSON.parse(contextJson) as Record<string, unknown>) : {},
      setLastSeenSequence: (sequence) => {
        lastSeenSequence = sequence;
      },
    });

    expect(mockLogForwardedNativeEntry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        message: 'buffered first',
        sequence: 1,
        tag: 'KidPointsNotifications',
      }),
      { source: 'buffer-first' },
    );
    expect(mockLogForwardedNativeEntry).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        message: 'buffered second',
        sequence: 2,
        tag: 'KidPointsNotificationsIntent',
      }),
      { source: 'buffer-second' },
    );
    expect(mockLogForwardedNativeEntry).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        message: 'live queued',
        sequence: 3,
        tag: 'KidPointsNotificationsIntent',
      }),
      { source: 'live-new' },
    );
    expect(mockLogForwardedNativeEntry).toHaveBeenCalledTimes(3);

    disconnect();
    if (!didCaptureLiveListener) {
      throw new Error(
        'Expected shared native log receiver to capture a listener',
      );
    }
    liveListener({
      contextJson: '{"source":"ignored"}',
      level: 'info',
      message: 'ignored after disconnect',
      sequence: 4,
      tag: 'KidPointsNotificationsIntent',
      timestampMs: 400,
    });

    expect(mockLogForwardedNativeEntry).toHaveBeenCalledTimes(3);
    expect(removeSubscription).toHaveBeenCalledTimes(1);
  });
});
