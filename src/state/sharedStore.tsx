import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useStore } from 'zustand';
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';

import type {
  ChildSnapshot,
  HomeTimerSummary,
  RestoreDescriptor,
  SharedCommandResult,
  SharedDocument,
  SharedEvent,
  SharedHead,
  TransactionRow,
  TransactionSummaryType,
} from './sharedTypes';

type SharedStoreState = {
  addChild: (name: string) => SharedCommandResult;
  adjustPoints: (childId: string, delta: number) => SharedCommandResult;
  archiveChild: (childId: string) => SharedCommandResult;
  deleteChildPermanently: (childId: string) => SharedCommandResult;
  document: SharedDocument;
  restoreChild: (childId: string) => SharedCommandResult;
  restoreTransaction: (
    target: RestoreDescriptor | string,
  ) => SharedCommandResult;
  setPoints: (childId: string, points: number) => SharedCommandResult;
};

type SharedStore = StoreApi<SharedStoreState>;

const SHARED_STORAGE_KEY = 'kidpoints.shared-document.v1';

const DEFAULT_HOME_TIMER_SUMMARY: HomeTimerSummary = {
  intervalLabel: '15 minute cadence',
  remainingLabel: '00:30',
  statusLabel: 'Read-only preview',
};

const SharedStoreContext = createContext<SharedStore | null>(null);

type SharedStoreProviderProps = PropsWithChildren<{
  initialDocument?: SharedDocument;
  storage?: StateStorage;
}>;

function generateId(prefix: string) {
  const randomPart = Math.random().toString(36).slice(2, 10);

  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

function cloneChildSnapshot(child: ChildSnapshot): ChildSnapshot {
  return { ...child };
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

export function createInitialSharedDocument({
  deviceId = generateId('device'),
}: {
  deviceId?: string;
} = {}): SharedDocument {
  return {
    deviceId,
    events: [],
    head: {
      activeChildIds: [],
      archivedChildIds: [],
      childrenById: {},
      homeTimerSummary: DEFAULT_HOME_TIMER_SUMMARY,
    },
    nextSequence: 1,
    schemaVersion: 1,
  };
}

function cloneHead(head: SharedHead): SharedHead {
  return {
    activeChildIds: [...head.activeChildIds],
    archivedChildIds: [...head.archivedChildIds],
    childrenById: Object.fromEntries(
      Object.entries(head.childrenById).map(([id, child]) => [
        id,
        cloneChildSnapshot(child),
      ]),
    ),
    homeTimerSummary: { ...head.homeTimerSummary },
  };
}

function insertUniqueId(ids: string[], id: string) {
  return ids.includes(id) ? ids : [...ids, id];
}

function removeId(ids: string[], id: string) {
  return ids.filter((value) => value !== id);
}

function sortEventsCanonical(events: SharedEvent[]) {
  return [...events].sort((left, right) => {
    if (left.deviceId !== right.deviceId) {
      return left.deviceId.localeCompare(right.deviceId);
    }

    return left.sequence - right.sequence;
  });
}

export function applySharedEvent(head: SharedHead, event: SharedEvent) {
  const nextHead = cloneHead(head);

  switch (event.type) {
    case 'child.created': {
      const child = cloneChildSnapshot(event.payload.child);

      nextHead.childrenById[child.id] = child;
      if (child.status === 'archived') {
        nextHead.archivedChildIds = insertUniqueId(
          nextHead.archivedChildIds,
          child.id,
        );
        nextHead.activeChildIds = removeId(nextHead.activeChildIds, child.id);
      } else {
        nextHead.activeChildIds = insertUniqueId(
          nextHead.activeChildIds,
          child.id,
        );
        nextHead.archivedChildIds = removeId(
          nextHead.archivedChildIds,
          child.id,
        );
      }
      return nextHead;
    }
    case 'child.pointsAdjusted': {
      const child = nextHead.childrenById[event.payload.childId];

      if (!child) {
        return nextHead;
      }

      nextHead.childrenById[event.payload.childId] = {
        ...child,
        points: child.points + event.payload.delta,
        updatedAt: event.occurredAt,
      };
      return nextHead;
    }
    case 'child.pointsSet': {
      const child = nextHead.childrenById[event.payload.childId];

      if (!child) {
        return nextHead;
      }

      nextHead.childrenById[event.payload.childId] = {
        ...child,
        points: event.payload.points,
        updatedAt: event.occurredAt,
      };
      return nextHead;
    }
    case 'child.archived': {
      const child = nextHead.childrenById[event.payload.childId];

      if (!child) {
        return nextHead;
      }

      nextHead.childrenById[event.payload.childId] = {
        ...child,
        archivedAt: event.occurredAt,
        status: 'archived',
        updatedAt: event.occurredAt,
      };
      nextHead.activeChildIds = removeId(nextHead.activeChildIds, child.id);
      nextHead.archivedChildIds = insertUniqueId(
        nextHead.archivedChildIds,
        child.id,
      );
      return nextHead;
    }
    case 'child.restored': {
      const child = nextHead.childrenById[event.payload.childId];

      if (!child) {
        return nextHead;
      }

      nextHead.childrenById[event.payload.childId] = {
        ...child,
        archivedAt: undefined,
        status: 'active',
        updatedAt: event.occurredAt,
      };
      nextHead.archivedChildIds = removeId(nextHead.archivedChildIds, child.id);
      nextHead.activeChildIds = insertUniqueId(
        nextHead.activeChildIds,
        child.id,
      );
      return nextHead;
    }
    case 'child.deleted': {
      const child = nextHead.childrenById[event.payload.childId];

      if (!child) {
        return nextHead;
      }

      delete nextHead.childrenById[event.payload.childId];
      nextHead.activeChildIds = removeId(nextHead.activeChildIds, child.id);
      nextHead.archivedChildIds = removeId(nextHead.archivedChildIds, child.id);
      return nextHead;
    }
  }
}

export function replaySharedDocument(document: SharedDocument): SharedDocument {
  const sortedEvents = sortEventsCanonical(document.events);
  const initialHead: SharedHead = {
    activeChildIds: [],
    archivedChildIds: [],
    childrenById: {},
    homeTimerSummary: DEFAULT_HOME_TIMER_SUMMARY,
  };
  const head = sortedEvents.reduce<SharedHead>(
    (currentHead, event) => applySharedEvent(currentHead, event),
    initialHead,
  );

  return {
    ...document,
    events: sortedEvents,
    head,
  };
}

function createEventBuilder(document: SharedDocument) {
  let nextSequence = document.nextSequence;

  return {
    build<T extends SharedEvent['type']>(
      type: T,
      payload: Extract<SharedEvent, { type: T }>['payload'],
      occurredAt = new Date().toISOString(),
    ) {
      const event: Extract<SharedEvent, { type: T }> = {
        deviceId: document.deviceId,
        eventId: `${document.deviceId}-${nextSequence}`,
        occurredAt,
        payload,
        sequence: nextSequence,
        type,
      } as Extract<SharedEvent, { type: T }>;

      nextSequence += 1;
      return event;
    },
    getNextSequence() {
      return nextSequence;
    },
  };
}

function commitSharedEvents(
  document: SharedDocument,
  eventsToAppend: SharedEvent[],
): SharedDocument {
  const lastEvent = eventsToAppend.at(-1);
  const nextDocument = replaySharedDocument({
    ...document,
    events: [...document.events, ...eventsToAppend],
    nextSequence:
      lastEvent?.sequence != null
        ? lastEvent.sequence + 1
        : document.nextSequence,
  });

  return nextDocument;
}

function getChild(head: SharedHead, childId: string) {
  return head.childrenById[childId] ?? null;
}

function getRowSummaryType(event: SharedEvent): TransactionSummaryType {
  switch (event.type) {
    case 'child.created':
      return 'child-created';
    case 'child.pointsAdjusted':
      return 'points-adjusted';
    case 'child.pointsSet':
      return 'points-set';
    case 'child.archived':
      return 'child-archived';
    case 'child.deleted':
      return 'child-deleted';
    case 'child.restored':
      return 'child-restored';
  }
}

export function deriveTransactionRows(events: SharedEvent[]): TransactionRow[] {
  const rows: TransactionRow[] = [];
  let currentHead: SharedHead = {
    activeChildIds: [],
    archivedChildIds: [],
    childrenById: {},
    homeTimerSummary: DEFAULT_HOME_TIMER_SUMMARY,
  };
  let pendingRow: TransactionRow | null = null;

  const finalizePendingRow = () => {
    if (!pendingRow) {
      return;
    }

    rows.push(pendingRow);
    pendingRow = null;
  };

  for (const event of sortEventsCanonical(events)) {
    const childId =
      event.type === 'child.created'
        ? event.payload.child.id
        : event.payload.childId;
    const childBefore = getChild(currentHead, childId);
    const summaryType = getRowSummaryType(event);
    const canExtendPendingRow =
      pendingRow &&
      summaryType === 'points-adjusted' &&
      pendingRow.summaryType === 'points-adjusted' &&
      pendingRow.childId === childId;

    currentHead = applySharedEvent(currentHead, event);
    const childAfter = getChild(currentHead, childId);

    if (!canExtendPendingRow) {
      finalizePendingRow();

      pendingRow = {
        childId,
        childName: childAfter?.name ?? childBefore?.name ?? null,
        delta:
          event.type === 'child.pointsAdjusted'
            ? event.payload.delta
            : undefined,
        eventIds: [event.eventId],
        id: `row-${event.eventId}`,
        occurredAtEnd: event.occurredAt,
        occurredAtStart: event.occurredAt,
        restoreDescriptor: {
          isRestorable: summaryType !== 'child-deleted',
          childId,
          sourceSummaryType: summaryType,
          target: childBefore ? cloneChildSnapshot(childBefore) : null,
        },
        setPoints:
          event.type === 'child.pointsSet' ? event.payload.points : undefined,
        summaryType,
      };
      continue;
    }

    if (pendingRow && event.type === 'child.pointsAdjusted') {
      pendingRow = {
        ...pendingRow,
        childName: childAfter?.name ?? pendingRow.childName,
        delta: (pendingRow.delta ?? 0) + event.payload.delta,
        eventIds: [...pendingRow.eventIds, event.eventId],
        occurredAtEnd: event.occurredAt,
      };
    }
  }

  finalizePendingRow();
  return rows;
}

function buildRestoreEvents(
  document: SharedDocument,
  descriptor: RestoreDescriptor,
) {
  if (!descriptor.isRestorable) {
    return [];
  }

  const builder = createEventBuilder(document);
  const eventsToAppend: SharedEvent[] = [];
  let workingHead = document.head;
  const currentChild = getChild(workingHead, descriptor.childId);
  const targetChild = descriptor.target;

  if (!currentChild) {
    if (targetChild) {
      const event = builder.build('child.created', {
        child: targetChild,
      });
      eventsToAppend.push(event);
    }

    return eventsToAppend;
  }

  if (!targetChild) {
    const event = builder.build('child.deleted', {
      childId: descriptor.childId,
    });
    eventsToAppend.push(event);

    return eventsToAppend;
  }

  if (currentChild.status !== targetChild.status) {
    const event =
      targetChild.status === 'active'
        ? builder.build('child.restored', { childId: descriptor.childId })
        : builder.build('child.archived', { childId: descriptor.childId });
    eventsToAppend.push(event);
    workingHead = applySharedEvent(workingHead, event);
  }

  const nextChild = getChild(workingHead, descriptor.childId);

  if (nextChild && nextChild.points !== targetChild.points) {
    const event = builder.build('child.pointsSet', {
      childId: descriptor.childId,
      points: targetChild.points,
    });
    eventsToAppend.push(event);
  }

  return eventsToAppend;
}

function createSharedStoreActions(
  set: (updater: (state: SharedStoreState) => SharedStoreState) => void,
) {
  return {
    addChild(name: string): SharedCommandResult {
      const normalizedName = normalizeName(name);

      if (!normalizedName) {
        return {
          error: 'Enter a child name before saving.',
          ok: false,
        };
      }

      const result: SharedCommandResult = { ok: true };

      set((state) => {
        const builder = createEventBuilder(state.document);
        const occurredAt = new Date().toISOString();
        const child: ChildSnapshot = {
          createdAt: occurredAt,
          id: generateId('child'),
          name: normalizedName,
          points: 0,
          status: 'active',
          updatedAt: occurredAt,
        };
        const event = builder.build('child.created', { child }, occurredAt);

        return {
          ...state,
          document: commitSharedEvents(state.document, [event]),
        };
      });

      return result;
    },
    adjustPoints(childId: string, delta: number): SharedCommandResult {
      if (!Number.isInteger(delta) || delta === 0) {
        return {
          error: 'Point adjustments must change the total by at least one.',
          ok: false,
        };
      }

      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const child = getChild(state.document.head, childId);

        if (!child || child.status !== 'active') {
          result = {
            error: 'Only active children can be adjusted.',
            ok: false,
          };
          return state;
        }

        const builder = createEventBuilder(state.document);
        const event = builder.build('child.pointsAdjusted', {
          childId,
          delta,
        });

        return {
          ...state,
          document: commitSharedEvents(state.document, [event]),
        };
      });

      return result;
    },
    archiveChild(childId: string): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const child = getChild(state.document.head, childId);

        if (!child || child.status !== 'active') {
          result = {
            error: 'Only active children can be archived.',
            ok: false,
          };
          return state;
        }

        const builder = createEventBuilder(state.document);
        const event = builder.build('child.archived', { childId });

        return {
          ...state,
          document: commitSharedEvents(state.document, [event]),
        };
      });

      return result;
    },
    deleteChildPermanently(childId: string): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const child = getChild(state.document.head, childId);

        if (!child || child.status !== 'archived') {
          result = {
            error: 'Only archived children can be deleted permanently.',
            ok: false,
          };
          return state;
        }

        const builder = createEventBuilder(state.document);
        const event = builder.build('child.deleted', { childId });

        return {
          ...state,
          document: commitSharedEvents(state.document, [event]),
        };
      });

      return result;
    },
    restoreChild(childId: string): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const child = getChild(state.document.head, childId);

        if (!child || child.status !== 'archived') {
          result = {
            error: 'Only archived children can be restored.',
            ok: false,
          };
          return state;
        }

        const builder = createEventBuilder(state.document);
        const event = builder.build('child.restored', { childId });

        return {
          ...state,
          document: commitSharedEvents(state.document, [event]),
        };
      });

      return result;
    },
    restoreTransaction(
      target: RestoreDescriptor | string,
    ): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const descriptor =
          typeof target === 'string'
            ? deriveTransactionRows(state.document.events).find(
                (row) => row.id === target,
              )?.restoreDescriptor
            : target;

        if (!descriptor) {
          result = {
            error: 'The requested transaction could not be restored.',
            ok: false,
          };
          return state;
        }

        const eventsToAppend = buildRestoreEvents(state.document, descriptor);

        if (eventsToAppend.length === 0) {
          result = {
            error: 'There is nothing to restore for that transaction.',
            ok: false,
          };
          return state;
        }

        return {
          ...state,
          document: commitSharedEvents(state.document, eventsToAppend),
        };
      });

      return result;
    },
    setPoints(childId: string, points: number): SharedCommandResult {
      if (!Number.isInteger(points)) {
        return {
          error: 'Exact point totals must be whole numbers.',
          ok: false,
        };
      }

      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const child = getChild(state.document.head, childId);

        if (!child) {
          result = {
            error: 'That child could not be found.',
            ok: false,
          };
          return state;
        }

        const builder = createEventBuilder(state.document);
        const event = builder.build('child.pointsSet', { childId, points });

        return {
          ...state,
          document: commitSharedEvents(state.document, [event]),
        };
      });

      return result;
    },
  };
}

function patchSharedStoreActions(store: SharedStore) {
  store.setState((state) => ({
    ...state,
    ...createSharedStoreActions((updater) => {
      store.setState((currentState) => updater(currentState));
    }),
  }));
}

export function createSharedStore({
  initialDocument = createInitialSharedDocument(),
  storage = AsyncStorage,
}: {
  initialDocument?: SharedDocument;
  storage?: StateStorage;
} = {}) {
  const store = createStore<SharedStoreState>()(
    persist(
      (set) => ({
        ...createSharedStoreActions((updater) => {
          set((state) => updater(state));
        }),
        document: replaySharedDocument(initialDocument),
      }),
      {
        merge: (persistedState, currentState) => {
          const nextState = persistedState as Partial<SharedStoreState> | null;

          if (!nextState?.document) {
            return currentState;
          }

          return {
            ...currentState,
            document: replaySharedDocument(nextState.document),
          };
        },
        name: SHARED_STORAGE_KEY,
        partialize: ({ document }) => ({ document }),
        storage: createJSONStorage(() => storage),
      },
    ),
  );

  patchSharedStoreActions(store);
  return store;
}

export function SharedStoreProvider({
  children,
  initialDocument,
  storage,
}: SharedStoreProviderProps) {
  const storeRef = useRef<SharedStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createSharedStore({
      initialDocument,
      storage,
    });
  }

  useEffect(() => {
    if (
      storeRef.current &&
      typeof storeRef.current.getState().deleteChildPermanently !== 'function'
    ) {
      patchSharedStoreActions(storeRef.current);
    }
  }, []);

  return (
    <SharedStoreContext.Provider value={storeRef.current}>
      {children}
    </SharedStoreContext.Provider>
  );
}

export function useSharedStore<T>(selector: (state: SharedStoreState) => T) {
  const store = useContext(SharedStoreContext);

  if (!store) {
    throw new Error('useSharedStore must be used within SharedStoreProvider');
  }

  return useStore(store, selector);
}

export function selectActiveChildren(state: SharedStoreState) {
  return state.document.head.activeChildIds
    .map((childId) => state.document.head.childrenById[childId])
    .filter(Boolean);
}

export function selectArchivedChildren(state: SharedStoreState) {
  return state.document.head.archivedChildIds
    .map((childId) => state.document.head.childrenById[childId])
    .filter(Boolean);
}

export function selectHasActiveChildren(state: SharedStoreState) {
  return state.document.head.activeChildIds.length > 0;
}

export function selectHomeTimerSummary(state: SharedStoreState) {
  return state.document.head.homeTimerSummary;
}

export function selectTransactionRows(state: SharedStoreState) {
  return deriveTransactionRows(state.document.events);
}

export function selectChildById(childId: string) {
  return (state: SharedStoreState) =>
    state.document.head.childrenById[childId] ?? null;
}

export function useSharedTransactions() {
  const rows = useSharedStore(selectTransactionRows);

  return useMemo(() => rows, [rows]);
}
