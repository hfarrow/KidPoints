import type { SharedTimerConfig, SharedTimerState } from './types';

export type TimerSnapshot = {
  currentCycleStartedAt: number | null;
  isRunning: boolean;
  nextTriggerAt: number | null;
  remainingMs: number;
};

export function computeTimerSnapshot(
  config: SharedTimerConfig,
  state: SharedTimerState,
  now: number,
): TimerSnapshot {
  const intervalMs = Math.max(config.intervalMinutes, 1) * 60 * 1000;

  if (!state.isRunning || state.cycleStartedAt === null) {
    return {
      currentCycleStartedAt: null,
      isRunning: false,
      nextTriggerAt: null,
      remainingMs: state.pausedRemainingMs ?? intervalMs,
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
