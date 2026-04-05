import { getTimerIntervalMs } from './timer';
import type {
  ChildProfile,
  ExpiredInterval,
  PersistedAppData,
  SharedTimerConfig,
  SharedTimerState,
  ThemeMode,
  TimerRuntimeState,
} from './types';

export const DEFAULT_PARENT_PIN = '0000';

const AVATAR_COLORS = ['#fb7185', '#38bdf8', '#34d399', '#f59e0b', '#a78bfa'];

export type AppDataAction =
  | { type: 'hydrate'; payload: PersistedAppData }
  | { type: 'addChild'; name: string }
  | { type: 'addChildRecord'; child: ChildProfile }
  | { type: 'renameChild'; childId: string; name: string }
  | { type: 'archiveChild'; childId: string; archivedAt: number }
  | { type: 'restoreChild'; childId: string }
  | { type: 'restoreChildToOrder'; childId: string; sortOrder: number }
  | { type: 'deleteChildPermanently'; childId: string }
  | { type: 'moveChild'; childId: string; direction: 'up' | 'down' }
  | { type: 'incrementPoints'; childId: string; amount: number }
  | { type: 'decrementPoints'; childId: string; amount: number }
  | { type: 'adjustPoints'; childId: string; delta: number }
  | { type: 'setPoints'; childId: string; points: number }
  | { type: 'replaceChildren'; children: PersistedAppData['children'] }
  | { type: 'setThemeMode'; themeMode: ThemeMode }
  | { type: 'updateTimerConfig'; patch: Partial<SharedTimerConfig> }
  | { type: 'startTimer'; startedAt: number }
  | { type: 'pauseTimer'; pausedAt: number }
  | { type: 'replaceTimerState'; timerState: SharedTimerState }
  | { type: 'replaceTimerRuntimeState'; timerRuntimeState: TimerRuntimeState }
  | { type: 'replaceExpiredIntervals'; expiredIntervals: ExpiredInterval[] }
  | {
      type: 'setExpiredIntervalChildStatus';
      childId: string;
      intervalId: string;
      status: ExpiredInterval['childActions'][number]['status'];
    }
  | { type: 'resetTimer' };

export function createDefaultAppData(): PersistedAppData {
  return {
    children: [],
    uiPreferences: {
      themeMode: 'system',
    },
    timerConfig: {
      intervalMinutes: 15,
      intervalSeconds: 0,
      notificationsEnabled: true,
      alarmSound: 'Chime',
      alarmDurationSeconds: 20,
    },
    timerState: {
      cycleStartedAt: null,
      isRunning: false,
      pausedRemainingMs: null,
    },
    timerRuntimeState: {
      sessionId: null,
      nextTriggerAt: null,
      lastTriggeredAt: null,
    },
    expiredIntervals: [],
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

export function createChildProfile(
  currentChildren: PersistedAppData['children'],
  name: string,
): ChildProfile {
  const nextIndex = getActiveChildren(currentChildren).length;

  return {
    id: createId(),
    displayName: name.trim(),
    points: 0,
    sortOrder: nextIndex,
    avatarColor: AVATAR_COLORS[nextIndex % AVATAR_COLORS.length],
    isArchived: false,
    archivedAt: null,
  };
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
      return {
        ...state,
        children: [
          ...state.children,
          createChildProfile(state.children, action.name),
        ],
      };
    }
    case 'addChildRecord':
      return {
        ...state,
        children: [...state.children, action.child],
      };
    case 'archiveChild':
      return archiveChild(state, action.childId, action.archivedAt);
    case 'restoreChild':
      return restoreChild(state, action.childId);
    case 'restoreChildToOrder':
      return restoreChildToOrder(state, action.childId, action.sortOrder);
    case 'deleteChildPermanently':
      return {
        ...state,
        children: normalizeActiveChildSortOrder(
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
      const orderedChildren = getActiveChildren(state.children);
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
        children: applyActiveChildOrder(state.children, reordered),
      };
    }
    case 'incrementPoints':
      return updatePoints(state, action.childId, action.amount);
    case 'decrementPoints':
      return updatePoints(state, action.childId, -action.amount);
    case 'adjustPoints':
      return updatePoints(state, action.childId, action.delta);
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
    case 'replaceChildren':
      return {
        ...state,
        children: action.children,
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
      return withDerivedTimerRuntimeState(state, {
        ...state,
        timerConfig: {
          ...state.timerConfig,
          ...action.patch,
        },
      });
    case 'startTimer':
      return startTimer(state, action.startedAt);
    case 'pauseTimer':
      return pauseTimer(state, action.pausedAt);
    case 'replaceTimerState':
      return withDerivedTimerRuntimeState(state, {
        ...state,
        timerState: action.timerState,
      });
    case 'replaceTimerRuntimeState':
      return {
        ...state,
        timerRuntimeState: action.timerRuntimeState,
      };
    case 'replaceExpiredIntervals':
      return {
        ...state,
        expiredIntervals: action.expiredIntervals,
      };
    case 'setExpiredIntervalChildStatus':
      return {
        ...state,
        expiredIntervals: state.expiredIntervals
          .map((interval) =>
            interval.intervalId !== action.intervalId
              ? interval
              : {
                  ...interval,
                  childActions: interval.childActions.map((childAction) =>
                    childAction.childId === action.childId
                      ? {
                          ...childAction,
                          status: action.status,
                        }
                      : childAction,
                  ),
                },
          )
          .filter((interval) =>
            interval.childActions.some(
              (childAction) => childAction.status === 'pending',
            ),
          ),
      };
    case 'resetTimer':
      return {
        ...state,
        timerState: {
          cycleStartedAt: null,
          isRunning: false,
          pausedRemainingMs: null,
        },
        timerRuntimeState: createDefaultTimerRuntimeState(),
        expiredIntervals: [],
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

function archiveChild(
  state: PersistedAppData,
  childId: string,
  archivedAt: number,
): PersistedAppData {
  return {
    ...state,
    children: normalizeActiveChildSortOrder(
      state.children.map((child) =>
        child.id === childId
          ? {
              ...child,
              isArchived: true,
              archivedAt,
            }
          : child,
      ),
    ),
  };
}

function restoreChild(
  state: PersistedAppData,
  childId: string,
): PersistedAppData {
  const nextSortOrder = getActiveChildren(state.children).length;

  return restoreChildToOrder(state, childId, nextSortOrder);
}

function restoreChildToOrder(
  state: PersistedAppData,
  childId: string,
  requestedSortOrder: number,
): PersistedAppData {
  const activeChildren = getActiveChildren(state.children);
  const nextSortOrder = Math.max(
    0,
    Math.min(requestedSortOrder, activeChildren.length),
  );

  return {
    ...state,
    children: state.children.map((child) => {
      if (child.id === childId) {
        return {
          ...child,
          isArchived: false,
          archivedAt: null,
          sortOrder: nextSortOrder,
        };
      }

      if (!child.isArchived && child.sortOrder >= nextSortOrder) {
        return {
          ...child,
          sortOrder: child.sortOrder + 1,
        };
      }

      return child;
    }),
  };
}

function startTimer(
  state: PersistedAppData,
  startedAt: number,
): PersistedAppData {
  const intervalMs = getTimerIntervalMs(state.timerConfig);
  const resumedRemainingMs = state.timerState.pausedRemainingMs;
  const cycleStartedAt =
    resumedRemainingMs === null
      ? startedAt
      : startedAt - (intervalMs - resumedRemainingMs);
  const isResuming =
    resumedRemainingMs !== null && state.timerRuntimeState.sessionId !== null;
  const nextTriggerAt = startedAt + (resumedRemainingMs ?? intervalMs);

  return {
    ...state,
    timerState: {
      cycleStartedAt,
      isRunning: true,
      pausedRemainingMs: null,
    },
    timerRuntimeState: {
      sessionId: isResuming
        ? state.timerRuntimeState.sessionId
        : createSessionId(startedAt),
      nextTriggerAt,
      lastTriggeredAt: isResuming
        ? state.timerRuntimeState.lastTriggeredAt
        : null,
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
      timerRuntimeState: {
        ...state.timerRuntimeState,
        nextTriggerAt: null,
      },
    };
  }

  const intervalMs = getTimerIntervalMs(state.timerConfig);
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
    timerRuntimeState: {
      ...state.timerRuntimeState,
      nextTriggerAt: null,
    },
  };
}

function withDerivedTimerRuntimeState(
  previousState: PersistedAppData,
  nextState: PersistedAppData,
) {
  if (
    !nextState.timerState.isRunning ||
    nextState.timerState.cycleStartedAt === null
  ) {
    return {
      ...nextState,
      timerRuntimeState: {
        ...nextState.timerRuntimeState,
        nextTriggerAt: null,
      },
    };
  }

  const intervalMs = getTimerIntervalMs(nextState.timerConfig);

  return {
    ...nextState,
    timerRuntimeState: {
      ...nextState.timerRuntimeState,
      sessionId:
        previousState.timerRuntimeState.sessionId ??
        nextState.timerRuntimeState.sessionId ??
        createSessionId(nextState.timerState.cycleStartedAt),
      nextTriggerAt: nextState.timerState.cycleStartedAt + intervalMs,
    },
  };
}

function createDefaultTimerRuntimeState(): TimerRuntimeState {
  return {
    sessionId: null,
    nextTriggerAt: null,
    lastTriggeredAt: null,
  };
}

function clampPoints(points: number) {
  return Math.max(Math.round(points), 0);
}

function getActiveChildren<
  T extends { isArchived: boolean; sortOrder: number },
>(children: T[]) {
  return sortChildren(children.filter((child) => !child.isArchived));
}

function normalizeActiveChildSortOrder<
  T extends { isArchived: boolean; sortOrder: number },
>(items: T[]) {
  let nextSortOrder = 0;

  return items.map((item) =>
    item.isArchived
      ? item
      : {
          ...item,
          sortOrder: nextSortOrder++,
        },
  );
}

function applyActiveChildOrder<
  T extends { id: string; isArchived: boolean; sortOrder: number },
>(allChildren: T[], orderedActiveChildren: T[]) {
  const activeChildrenById = new Map<string, T>(
    orderedActiveChildren.map((child, index) => [
      child.id,
      {
        ...child,
        sortOrder: index,
      } satisfies T,
    ]),
  );

  return allChildren.map((child) =>
    child.isArchived ? child : (activeChildrenById.get(child.id) ?? child),
  );
}

function createId() {
  return `kid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSessionId(timestamp: number) {
  return `session-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
}
