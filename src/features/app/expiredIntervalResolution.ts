import { appDataReducer } from './state';
import {
  commitSharedTransaction,
  type PersistedAppDocument,
} from './transactions';

type ResolveExpiredIntervalOptions = {
  actorDeviceName: string;
  childId: string;
  intervalId: string;
  occurredAt: number;
  status: 'awarded' | 'dismissed';
};

export function resolveExpiredInterval(
  document: PersistedAppDocument,
  options: ResolveExpiredIntervalOptions,
): {
  document: PersistedAppDocument;
  shouldRestartTimer: boolean;
} {
  const { actorDeviceName, childId, intervalId, occurredAt, status } = options;

  let nextDocument =
    status === 'awarded'
      ? commitSharedTransaction(
          document,
          {
            type: 'incrementPoints',
            amount: 1,
            childId,
          },
          {
            actorDeviceName,
            occurredAt,
          },
        )
      : document;

  let nextHead = {
    ...nextDocument.head,
    expiredIntervals: document.head.expiredIntervals,
    timerRuntimeState: document.head.timerRuntimeState,
    timerState: document.head.timerState,
  };

  nextHead = appDataReducer(nextHead, {
    type: 'setExpiredIntervalChildStatus',
    childId,
    intervalId,
    status,
  });

  nextDocument = {
    ...nextDocument,
    head: nextHead,
  };

  const shouldRestartTimer = !document.head.timerState.isRunning;
  const preservedExpiredIntervals = nextHead.expiredIntervals;

  if (shouldRestartTimer) {
    nextDocument = commitSharedTransaction(
      nextDocument,
      {
        type: 'startTimer',
        startedAt: occurredAt,
      },
      {
        actorDeviceName,
        occurredAt,
      },
    );

    nextDocument = {
      ...nextDocument,
      head: {
        ...nextDocument.head,
        expiredIntervals: preservedExpiredIntervals,
      },
    };
  }

  return {
    document: nextDocument,
    shouldRestartTimer,
  };
}

export function buildResetTimerDocument(
  document: PersistedAppDocument,
  options: {
    actorDeviceName: string;
    occurredAt: number;
  },
): PersistedAppDocument {
  const { actorDeviceName, occurredAt } = options;
  const nextDocument = commitSharedTransaction(
    document,
    {
      type: 'resetTimer',
    },
    {
      actorDeviceName,
      occurredAt,
    },
  );

  return {
    ...nextDocument,
    head: appDataReducer(document.head, {
      type: 'resetTimer',
    }),
  };
}
