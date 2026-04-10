import type { AppLogger } from '../../src/logging/logger';
import {
  createNativeLogReplayController,
  parseBufferedNativeLogEntries,
  parseNativeLogEntry,
} from '../../src/logging/nativeLogSync';

function createMockLogger() {
  return {
    warn: jest.fn(),
  } as unknown as AppLogger;
}

describe('nativeLogSync', () => {
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
});
