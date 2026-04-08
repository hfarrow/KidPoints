import { useEffect } from 'react';
import { create } from 'zustand';

import { createModuleLogger } from '../logging/logger';

export type StartupNavigationRequest = {
  href: string;
  id: string;
  priority?: number;
  source: string;
  targetPathname: string;
};

type QueuedStartupNavigationRequest = StartupNavigationRequest & {
  priority: number;
  sequence: number;
};

type StartupNavigationState = {
  completeRequest: (id: string) => void;
  nextSequence: number;
  queueRequest: (request: StartupNavigationRequest) => void;
  removeRequest: (id: string) => void;
  requests: QueuedStartupNavigationRequest[];
};

const log = createModuleLogger('startup-navigation-store');

function areStartupNavigationRequestsEquivalent(
  left: StartupNavigationRequest,
  right: StartupNavigationRequest,
) {
  return (
    left.href === right.href &&
    left.id === right.id &&
    (left.priority ?? 0) === (right.priority ?? 0) &&
    left.source === right.source &&
    left.targetPathname === right.targetPathname
  );
}

function sortRequests(
  requests: QueuedStartupNavigationRequest[],
): QueuedStartupNavigationRequest[] {
  return [...requests].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return left.sequence - right.sequence;
  });
}

export const useStartupNavigationStore = create<StartupNavigationState>(
  (set, get) => ({
    completeRequest: (id) => {
      log.debug('Startup navigation mutation committed', {
        action: 'completeRequest',
        requestId: id,
      });

      set((state) => ({
        ...state,
        requests: state.requests.filter((request) => request.id !== id),
      }));
    },
    nextSequence: 1,
    queueRequest: (request) => {
      const existingRequest = get().requests.find(
        (candidate) => candidate.id === request.id,
      );

      if (
        existingRequest &&
        areStartupNavigationRequestsEquivalent(existingRequest, request)
      ) {
        return;
      }

      log.debug('Startup navigation mutation committed', {
        action: 'queueRequest',
        href: request.href,
        requestId: request.id,
        source: request.source,
        targetPathname: request.targetPathname,
      });

      set((state) => {
        const currentRequest = state.requests.find(
          (candidate) => candidate.id === request.id,
        );

        if (currentRequest) {
          return {
            ...state,
            requests: sortRequests(
              state.requests.map((candidate) =>
                candidate.id === request.id
                  ? {
                      ...candidate,
                      ...request,
                      priority: request.priority ?? candidate.priority,
                    }
                  : candidate,
              ),
            ),
          };
        }

        return {
          nextSequence: state.nextSequence + 1,
          requests: sortRequests([
            ...state.requests,
            {
              ...request,
              priority: request.priority ?? 0,
              sequence: state.nextSequence,
            },
          ]),
        };
      });
    },
    removeRequest: (id) => {
      log.debug('Startup navigation mutation committed', {
        action: 'removeRequest',
        requestId: id,
      });

      set((state) => ({
        ...state,
        requests: state.requests.filter((request) => request.id !== id),
      }));
    },
    requests: [],
  }),
);

export function clearStartupNavigationRequests() {
  useStartupNavigationStore.setState({
    nextSequence: 1,
    requests: [],
  });
}

export function useStartupNavigationRequest(
  request: StartupNavigationRequest & {
    enabled: boolean;
  },
) {
  const { enabled, href, id, priority, source, targetPathname } = request;
  const queueRequest = useStartupNavigationStore((state) => state.queueRequest);
  const removeRequest = useStartupNavigationStore(
    (state) => state.removeRequest,
  );

  useEffect(() => {
    if (!enabled) {
      removeRequest(id);
      return;
    }

    queueRequest({
      href,
      id,
      priority,
      source,
      targetPathname,
    });

    return () => {
      removeRequest(id);
    };
  }, [
    enabled,
    href,
    id,
    priority,
    queueRequest,
    removeRequest,
    source,
    targetPathname,
  ]);
}
