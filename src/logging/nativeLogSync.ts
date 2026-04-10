import type {
  AppLogDetails,
  AppLogger,
  ForwardedNativeAppLogLevel,
} from './logger';
import { logForwardedNativeEntry } from './logger';

export type NativeLogEntry = {
  contextJson: string | null;
  level: ForwardedNativeAppLogLevel;
  message: string;
  sequence: number;
  tag: string;
  timestampMs: number;
};

export function parseNativeLogEntry(value: unknown): NativeLogEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const entry = value as Partial<NativeLogEntry>;

  if (
    typeof entry.message !== 'string' ||
    typeof entry.sequence !== 'number' ||
    typeof entry.tag !== 'string' ||
    typeof entry.timestampMs !== 'number'
  ) {
    return null;
  }

  return {
    contextJson:
      typeof entry.contextJson === 'string' ? entry.contextJson : null,
    level: normalizeNativeLogLevel(entry.level),
    message: entry.message,
    sequence: entry.sequence,
    tag: entry.tag,
    timestampMs: entry.timestampMs,
  };
}

export function parseBufferedNativeLogEntries({
  logEntriesJson,
  logger,
  sourceLabel,
}: {
  logEntriesJson: string;
  logger: AppLogger;
  sourceLabel: string;
}): NativeLogEntry[] {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(logEntriesJson);
  } catch {
    logger.warn(`Failed to parse ${sourceLabel} buffered native logs payload`);
    return [];
  }

  if (!Array.isArray(parsedValue)) {
    logger.warn(`Ignored ${sourceLabel} buffered native logs payload`, {
      reason: 'not-an-array',
    });
    return [];
  }

  return parsedValue
    .map((entry) => parseNativeLogEntry(entry))
    .filter((entry): entry is NativeLogEntry => entry != null);
}

export function createNativeLogReplayController<T extends NativeLogEntry>({
  getLastSeenSequence,
  onForward,
  setLastSeenSequence,
}: {
  getLastSeenSequence: () => number;
  onForward: (entry: T) => void;
  setLastSeenSequence: (sequence: number) => void;
}) {
  let hasReplayedBufferedEntries = false;
  let queuedLiveEntries: T[] = [];

  const forwardEntry = (entry: T) => {
    if (entry.sequence <= getLastSeenSequence()) {
      return;
    }

    setLastSeenSequence(entry.sequence);
    onForward(entry);
  };

  return {
    handleLiveEntry(entry: T) {
      if (!hasReplayedBufferedEntries) {
        queuedLiveEntries.push(entry);
        return;
      }

      forwardEntry(entry);
    },
    replayBufferedEntries(entries: T[]) {
      [...entries]
        .sort(
          (firstEntry, secondEntry) =>
            firstEntry.sequence - secondEntry.sequence,
        )
        .forEach(forwardEntry);
      hasReplayedBufferedEntries = true;
      queuedLiveEntries
        .sort(
          (firstEntry, secondEntry) =>
            firstEntry.sequence - secondEntry.sequence,
        )
        .forEach(forwardEntry);
      queuedLiveEntries = [];
    },
  };
}

type NativeLogSubscription = {
  remove?: () => void;
} | null;

export function connectNativeLogReceiver<T extends NativeLogEntry>({
  addLogListener,
  getBufferedEntries,
  getLastSeenSequence,
  parseContextJson,
  setLastSeenSequence,
}: {
  addLogListener: (listener: (entry: T) => void) => NativeLogSubscription;
  getBufferedEntries: (afterSequence: number) => T[];
  getLastSeenSequence: () => number;
  parseContextJson?: (contextJson: string | null, entry: T) => AppLogDetails;
  setLastSeenSequence: (sequence: number) => void;
}) {
  let isCancelled = false;
  const nativeLogReplayController = createNativeLogReplayController<T>({
    getLastSeenSequence,
    onForward: (entry) => {
      logForwardedNativeEntry(
        entry,
        parseContextJson?.(entry.contextJson, entry) ?? {},
      );
    },
    setLastSeenSequence,
  });
  const logSubscription = addLogListener((entry) => {
    if (isCancelled) {
      return;
    }

    nativeLogReplayController.handleLiveEntry(entry);
  });
  const bufferedLogEntries = getBufferedEntries(getLastSeenSequence());

  nativeLogReplayController.replayBufferedEntries(bufferedLogEntries);

  return () => {
    isCancelled = true;
    logSubscription?.remove?.();
  };
}

function normalizeNativeLogLevel(level: unknown): ForwardedNativeAppLogLevel {
  switch (level) {
    case 'error':
    case 'info':
    case 'temp':
    case 'warn':
      return level;
    default:
      return 'debug';
  }
}
