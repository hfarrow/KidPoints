import type {
  SharedTimerConfig,
  SharedTimerState,
  TimerRuntimeState,
} from './types';

export type TimerSnapshot = {
  currentCycleStartedAt: number | null;
  isRunning: boolean;
  nextTriggerAt: number | null;
  remainingMs: number;
};

export function getTimerIntervalMs(config: SharedTimerConfig) {
  const normalizedMinutes = Math.max(Math.trunc(config.intervalMinutes), 0);
  const normalizedSeconds = Math.min(
    Math.max(Math.trunc(config.intervalSeconds), 0),
    59,
  );

  return Math.max(
    normalizedMinutes * 60_000 + normalizedSeconds * 1_000,
    1_000,
  );
}

export function computeTimerSnapshot(
  config: SharedTimerConfig,
  state: SharedTimerState,
  runtimeState: TimerRuntimeState,
  now: number,
): TimerSnapshot {
  const intervalMs = getTimerIntervalMs(config);

  if (!state.isRunning || state.cycleStartedAt === null) {
    return {
      currentCycleStartedAt: null,
      isRunning: false,
      nextTriggerAt: null,
      remainingMs: state.pausedRemainingMs ?? intervalMs,
    };
  }

  if (runtimeState.nextTriggerAt !== null) {
    const remainingMs = Math.max(runtimeState.nextTriggerAt - now, 0);

    return {
      currentCycleStartedAt: runtimeState.nextTriggerAt - intervalMs,
      isRunning: true,
      nextTriggerAt: runtimeState.nextTriggerAt,
      remainingMs,
    };
  }

  const elapsedMs = Math.max(now - state.cycleStartedAt, 0);
  const remainderMs = elapsedMs % intervalMs;
  const hasCompletedBoundary = elapsedMs > 0 && remainderMs === 0;
  const currentCycleStartedAt = hasCompletedBoundary ? now : now - remainderMs;
  const remainingMs = hasCompletedBoundary
    ? intervalMs
    : intervalMs - remainderMs;

  return {
    currentCycleStartedAt,
    isRunning: true,
    nextTriggerAt: now + remainingMs,
    remainingMs,
  };
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatTime(timestamp: number | null) {
  if (!timestamp) {
    return 'Not scheduled';
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}
