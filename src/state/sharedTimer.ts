import type {
  SharedTimerConfig,
  SharedTimerMode,
  SharedTimerState,
} from './sharedTypes';

export type SharedTimerStatus = 'expired' | 'idle' | 'paused' | 'running';

export type SharedTimerSnapshot = {
  currentCycleStartedAt: number | null;
  intervalMs: number;
  isExpired: boolean;
  isRunning: boolean;
  nextTriggerAt: number | null;
  remainingMs: number;
  status: SharedTimerStatus;
};

export type SharedTimerViewModel = SharedTimerSnapshot & {
  alarmDurationLabel: string;
  canPause: boolean;
  canReset: boolean;
  canStart: boolean;
  cadenceLabel: string;
  remainingLabel: string;
  statusLabel: string;
  statusTone: 'good' | 'neutral' | 'warning';
};

export const DEFAULT_TIMER_CONFIG: SharedTimerConfig = {
  alarmDurationSeconds: 20,
  intervalMinutes: 15,
  intervalSeconds: 0,
};

export const DEFAULT_TIMER_STATE: SharedTimerState = {
  cycleStartedAt: null,
  mode: 'idle',
  pausedRemainingMs: null,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toFiniteInteger(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;
}

function normalizeTimerMode(value: unknown): SharedTimerMode {
  return value === 'running' || value === 'paused' || value === 'idle'
    ? value
    : 'idle';
}

export function cloneTimerConfig(timerConfig: SharedTimerConfig) {
  return { ...timerConfig };
}

export function cloneTimerState(timerState: SharedTimerState) {
  return { ...timerState };
}

export function normalizeTimerConfig(
  timerConfig: Partial<SharedTimerConfig> | null | undefined,
  fallback: SharedTimerConfig = DEFAULT_TIMER_CONFIG,
): SharedTimerConfig {
  const normalizedMinutes = Math.max(
    toFiniteInteger(timerConfig?.intervalMinutes, fallback.intervalMinutes),
    0,
  );
  const normalizedSeconds = Math.max(
    toFiniteInteger(timerConfig?.intervalSeconds, fallback.intervalSeconds),
    0,
  );
  const totalSeconds = Math.max(normalizedMinutes * 60 + normalizedSeconds, 1);

  return {
    alarmDurationSeconds: Math.max(
      toFiniteInteger(
        timerConfig?.alarmDurationSeconds,
        fallback.alarmDurationSeconds,
      ),
      1,
    ),
    intervalMinutes: Math.floor(totalSeconds / 60),
    intervalSeconds: totalSeconds % 60,
  };
}

export function normalizeTimerState(
  timerState: Partial<SharedTimerState> | null | undefined,
): SharedTimerState {
  const mode = normalizeTimerMode(timerState?.mode);
  const cycleStartedAt =
    typeof timerState?.cycleStartedAt === 'number' &&
    Number.isFinite(timerState.cycleStartedAt)
      ? timerState.cycleStartedAt
      : null;
  const pausedRemainingMs =
    typeof timerState?.pausedRemainingMs === 'number' &&
    Number.isFinite(timerState.pausedRemainingMs)
      ? Math.max(Math.trunc(timerState.pausedRemainingMs), 0)
      : null;

  if (mode === 'running' && cycleStartedAt !== null) {
    return {
      cycleStartedAt,
      mode,
      pausedRemainingMs: null,
    };
  }

  if (mode === 'paused') {
    return {
      cycleStartedAt: null,
      mode,
      pausedRemainingMs,
    };
  }

  return cloneTimerState(DEFAULT_TIMER_STATE);
}

export function areTimerConfigsEquivalent(
  left: SharedTimerConfig,
  right: SharedTimerConfig,
) {
  return (
    left.alarmDurationSeconds === right.alarmDurationSeconds &&
    left.intervalMinutes === right.intervalMinutes &&
    left.intervalSeconds === right.intervalSeconds
  );
}

export function areTimerStatesEquivalent(
  left: SharedTimerState,
  right: SharedTimerState,
) {
  return (
    left.cycleStartedAt === right.cycleStartedAt &&
    left.mode === right.mode &&
    left.pausedRemainingMs === right.pausedRemainingMs
  );
}

export function getTimerIntervalMs(timerConfig: SharedTimerConfig) {
  return Math.max(
    timerConfig.intervalMinutes * 60_000 + timerConfig.intervalSeconds * 1_000,
    1_000,
  );
}

export function computeSharedTimerSnapshot(
  timerConfig: SharedTimerConfig,
  timerState: SharedTimerState,
  now: number,
): SharedTimerSnapshot {
  const intervalMs = getTimerIntervalMs(timerConfig);

  if (timerState.mode === 'paused') {
    const pausedRemainingMs = clamp(
      timerState.pausedRemainingMs ?? intervalMs,
      0,
      intervalMs,
    );

    return {
      currentCycleStartedAt: null,
      intervalMs,
      isExpired: false,
      isRunning: false,
      nextTriggerAt: null,
      remainingMs: pausedRemainingMs,
      status: 'paused',
    };
  }

  if (timerState.mode !== 'running' || timerState.cycleStartedAt === null) {
    return {
      currentCycleStartedAt: null,
      intervalMs,
      isExpired: false,
      isRunning: false,
      nextTriggerAt: null,
      remainingMs: intervalMs,
      status: 'idle',
    };
  }

  const remainingMs = Math.max(timerState.cycleStartedAt + intervalMs - now, 0);
  const isExpired = remainingMs === 0;

  return {
    currentCycleStartedAt: timerState.cycleStartedAt,
    intervalMs,
    isExpired,
    isRunning: !isExpired,
    nextTriggerAt: isExpired ? null : timerState.cycleStartedAt + intervalMs,
    remainingMs,
    status: isExpired ? 'expired' : 'running',
  };
}

export function formatTimerDuration(ms: number) {
  const totalSeconds = Math.max(Math.ceil(ms / 1_000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatTimerCadenceLabel(timerConfig: SharedTimerConfig) {
  const totalSeconds =
    timerConfig.intervalMinutes * 60 + timerConfig.intervalSeconds;

  if (timerConfig.intervalMinutes > 0 && timerConfig.intervalSeconds === 0) {
    return `${timerConfig.intervalMinutes}m cadence`;
  }

  if (timerConfig.intervalMinutes === 0) {
    return `${totalSeconds}s cadence`;
  }

  return `${timerConfig.intervalMinutes}m ${timerConfig.intervalSeconds}s cadence`;
}

export function formatAlarmDurationLabel(timerConfig: SharedTimerConfig) {
  return `${timerConfig.alarmDurationSeconds}s alarm`;
}

export function getTimerStatusLabel(status: SharedTimerStatus) {
  switch (status) {
    case 'running':
      return 'Running';
    case 'paused':
      return 'Paused';
    case 'expired':
      return 'Expired';
    default:
      return 'Ready';
  }
}

export function getTimerStatusTone(status: SharedTimerStatus) {
  switch (status) {
    case 'running':
      return 'good';
    case 'expired':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function buildSharedTimerViewModel(
  timerConfig: SharedTimerConfig,
  timerState: SharedTimerState,
  now: number,
): SharedTimerViewModel {
  const snapshot = computeSharedTimerSnapshot(timerConfig, timerState, now);

  return {
    ...snapshot,
    alarmDurationLabel: formatAlarmDurationLabel(timerConfig),
    canPause: snapshot.status === 'running',
    canReset: snapshot.status !== 'idle',
    canStart: snapshot.status !== 'running',
    cadenceLabel: formatTimerCadenceLabel(timerConfig),
    remainingLabel: formatTimerDuration(snapshot.remainingMs),
    statusLabel: getTimerStatusLabel(snapshot.status),
    statusTone: getTimerStatusTone(snapshot.status),
  };
}
