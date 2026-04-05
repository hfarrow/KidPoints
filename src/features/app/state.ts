import type { PersistedAppData, SharedTimerConfig, ThemeMode } from './types';

export const DEFAULT_PARENT_PIN = '0000';

const AVATAR_COLORS = ['#fb7185', '#38bdf8', '#34d399', '#f59e0b', '#a78bfa'];

export type AppDataAction =
  | { type: 'hydrate'; payload: PersistedAppData }
  | { type: 'addChild'; name: string }
  | { type: 'renameChild'; childId: string; name: string }
  | { type: 'removeChild'; childId: string }
  | { type: 'moveChild'; childId: string; direction: 'up' | 'down' }
  | { type: 'incrementPoints'; childId: string; amount: number }
  | { type: 'decrementPoints'; childId: string; amount: number }
  | { type: 'setPoints'; childId: string; points: number }
  | { type: 'setThemeMode'; themeMode: ThemeMode }
  | { type: 'updateTimerConfig'; patch: Partial<SharedTimerConfig> }
  | { type: 'startTimer'; startedAt: number }
  | { type: 'pauseTimer'; pausedAt: number }
  | { type: 'resetTimer' };

export function createDefaultAppData(): PersistedAppData {
  return {
    children: [],
    uiPreferences: {
      themeMode: 'system',
    },
    timerConfig: {
      intervalMinutes: 15,
      notificationsEnabled: true,
      alarmSound: 'Chime',
      alarmDurationSeconds: 20,
    },
    timerState: {
      cycleStartedAt: null,
      isRunning: false,
      pausedRemainingMs: null,
    },
    parentSettings: {
      pin: DEFAULT_PARENT_PIN,
    },
    shopCatalog: {
      items: [],
      updatedAt: null,
    },
    cart: {
      itemIds: [],
    },
  };
}

export function sortChildren<T extends { sortOrder: number }>(children: T[]) {
  return [...children].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function verifyParentPin(
  appData: PersistedAppData,
  attemptedPin: string,
) {
  return attemptedPin === appData.parentSettings.pin;
}

export function appDataReducer(
  state: PersistedAppData,
  action: AppDataAction,
): PersistedAppData {
  switch (action.type) {
    case 'hydrate':
      return action.payload;
    case 'addChild': {
      const orderedChildren = sortChildren(state.children);
      const nextIndex = orderedChildren.length;

      return {
        ...state,
        children: [
          ...orderedChildren,
          {
            id: createId(),
            displayName: action.name.trim(),
            points: 0,
            sortOrder: nextIndex,
            avatarColor: AVATAR_COLORS[nextIndex % AVATAR_COLORS.length],
            isActive: true,
          },
        ],
      };
    }
    case 'removeChild':
      return {
        ...state,
        children: normalizeSortOrder(
          state.children.filter((child) => child.id !== action.childId),
        ),
      };
    case 'renameChild':
      return {
        ...state,
        children: state.children.map((child) =>
          child.id === action.childId
            ? {
                ...child,
                displayName: action.name.trim(),
              }
            : child,
        ),
      };
    case 'moveChild': {
      const orderedChildren = sortChildren(state.children);
      const currentIndex = orderedChildren.findIndex(
        (child) => child.id === action.childId,
      );

      if (currentIndex === -1) {
        return state;
      }

      const swapIndex =
        action.direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (swapIndex < 0 || swapIndex >= orderedChildren.length) {
        return state;
      }

      const reordered = [...orderedChildren];
      const [movedChild] = reordered.splice(currentIndex, 1);
      reordered.splice(swapIndex, 0, movedChild);

      return {
        ...state,
        children: normalizeSortOrder(reordered),
      };
    }
    case 'incrementPoints':
      return updatePoints(state, action.childId, action.amount);
    case 'decrementPoints':
      return updatePoints(state, action.childId, -action.amount);
    case 'setPoints':
      return {
        ...state,
        children: state.children.map((child) =>
          child.id === action.childId
            ? {
                ...child,
                points: clampPoints(action.points),
              }
            : child,
        ),
      };
    case 'setThemeMode':
      return {
        ...state,
        uiPreferences: {
          ...state.uiPreferences,
          themeMode: action.themeMode,
        },
      };
    case 'updateTimerConfig':
      return {
        ...state,
        timerConfig: {
          ...state.timerConfig,
          ...action.patch,
        },
      };
    case 'startTimer':
      return startTimer(state, action.startedAt);
    case 'pauseTimer':
      return pauseTimer(state, action.pausedAt);
    case 'resetTimer':
      return {
        ...state,
        timerState: {
          cycleStartedAt: null,
          isRunning: false,
          pausedRemainingMs: null,
        },
      };
    default:
      return state;
  }
}

function updatePoints(
  state: PersistedAppData,
  childId: string,
  delta: number,
): PersistedAppData {
  return {
    ...state,
    children: state.children.map((child) =>
      child.id === childId
        ? {
            ...child,
            points: clampPoints(child.points + delta),
          }
        : child,
    ),
  };
}

function startTimer(
  state: PersistedAppData,
  startedAt: number,
): PersistedAppData {
  const intervalMs = Math.max(state.timerConfig.intervalMinutes, 1) * 60 * 1000;
  const resumedRemainingMs = state.timerState.pausedRemainingMs;
  const cycleStartedAt =
    resumedRemainingMs === null
      ? startedAt
      : startedAt - (intervalMs - resumedRemainingMs);

  return {
    ...state,
    timerState: {
      cycleStartedAt,
      isRunning: true,
      pausedRemainingMs: null,
    },
  };
}

function pauseTimer(
  state: PersistedAppData,
  pausedAt: number,
): PersistedAppData {
  if (!state.timerState.isRunning || state.timerState.cycleStartedAt === null) {
    return {
      ...state,
      timerState: {
        ...state.timerState,
        isRunning: false,
      },
    };
  }

  const intervalMs = Math.max(state.timerConfig.intervalMinutes, 1) * 60 * 1000;
  const elapsedMs = Math.max(pausedAt - state.timerState.cycleStartedAt, 0);
  const remainderMs = elapsedMs % intervalMs;
  const hasCompletedBoundary = elapsedMs > 0 && remainderMs === 0;
  const pausedRemainingMs = hasCompletedBoundary
    ? intervalMs
    : intervalMs - remainderMs;

  return {
    ...state,
    timerState: {
      cycleStartedAt: null,
      isRunning: false,
      pausedRemainingMs,
    },
  };
}

function clampPoints(points: number) {
  return Math.max(Math.round(points), 0);
}

function normalizeSortOrder<T extends { sortOrder: number }>(items: T[]) {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

function createId() {
  return `kid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
