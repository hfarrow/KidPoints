import {
  usePathname,
  useRootNavigationState,
  useRouter,
  useSegments,
} from 'expo-router';
import { useEffect, useRef } from 'react';

import { createModuleLogger } from '../logging/logger';
import { useStartupNavigationStore } from './startupNavigationStore';

const STARTUP_NAVIGATION_TIMEOUT_MS = 1000;
const log = createModuleLogger('startup-navigation-coordinator');

function scheduleAfterConcreteRouteCommit(callback: () => void) {
  if (
    typeof requestAnimationFrame === 'function' &&
    typeof cancelAnimationFrame === 'function'
  ) {
    let secondFrameId: number | null = null;
    const firstFrameId = requestAnimationFrame(() => {
      secondFrameId = requestAnimationFrame(() => {
        callback();
      });
    });

    return () => {
      cancelAnimationFrame(firstFrameId);

      if (secondFrameId != null) {
        cancelAnimationFrame(secondFrameId);
      }
    };
  }

  let secondTimeout: ReturnType<typeof setTimeout> | null = null;
  const firstTimeout = setTimeout(() => {
    secondTimeout = setTimeout(() => {
      callback();
    }, 0);
  }, 0);

  return () => {
    clearTimeout(firstTimeout);

    if (secondTimeout) {
      clearTimeout(secondTimeout);
    }
  };
}

export function StartupNavigationCoordinator() {
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const router = useRouter();
  const segments = useSegments();
  const completeRequest = useStartupNavigationStore(
    (state) => state.completeRequest,
  );
  const currentRequest = useStartupNavigationStore(
    (state) => state.requests[0] ?? null,
  );
  const currentPathRef = useRef(pathname);
  const scheduledRequestIdRef = useRef<string | null>(null);
  const cancelScheduledDispatchRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentPath = segments.join('/') || '(root)';
  const isConcreteRouteReady =
    Boolean(rootNavigationState?.key) && segmentPath !== '(root)';

  useEffect(() => {
    currentPathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (cancelScheduledDispatchRef.current) {
        cancelScheduledDispatchRef.current();
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentRequest) {
      scheduledRequestIdRef.current = null;
      return;
    }

    if (pathname === currentRequest.targetPathname) {
      log.info('Startup navigation completed', {
        href: currentRequest.href,
        pathname,
        requestId: currentRequest.id,
        source: currentRequest.source,
      });

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      scheduledRequestIdRef.current = null;
      completeRequest(currentRequest.id);
    }
  }, [completeRequest, currentRequest, pathname]);

  useEffect(() => {
    if (
      !currentRequest ||
      !isConcreteRouteReady ||
      pathname === currentRequest.targetPathname ||
      scheduledRequestIdRef.current === currentRequest.id
    ) {
      return;
    }

    scheduledRequestIdRef.current = currentRequest.id;
    log.info('Startup navigation scheduled', {
      href: currentRequest.href,
      pathname,
      requestId: currentRequest.id,
      rootNavigationKey: rootNavigationState?.key ?? null,
      segments: segmentPath,
      source: currentRequest.source,
      targetPathname: currentRequest.targetPathname,
    });

    cancelScheduledDispatchRef.current = scheduleAfterConcreteRouteCommit(
      () => {
        log.info('Startup navigation dispatched', {
          href: currentRequest.href,
          pathname: currentPathRef.current,
          requestId: currentRequest.id,
          source: currentRequest.source,
          targetPathname: currentRequest.targetPathname,
        });
        router.push(currentRequest.href);

        timeoutRef.current = setTimeout(() => {
          if (currentPathRef.current !== currentRequest.targetPathname) {
            log.error('Startup navigation target not reached after dispatch', {
              currentPathname: currentPathRef.current,
              href: currentRequest.href,
              requestId: currentRequest.id,
              source: currentRequest.source,
              targetPathname: currentRequest.targetPathname,
            });
          }
        }, STARTUP_NAVIGATION_TIMEOUT_MS);
      },
    );

    return () => {
      if (cancelScheduledDispatchRef.current) {
        cancelScheduledDispatchRef.current();
        cancelScheduledDispatchRef.current = null;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (scheduledRequestIdRef.current === currentRequest.id) {
        scheduledRequestIdRef.current = null;
      }
    };
  }, [
    currentRequest,
    isConcreteRouteReady,
    pathname,
    rootNavigationState?.key,
    router,
    segmentPath,
  ]);

  return null;
}
