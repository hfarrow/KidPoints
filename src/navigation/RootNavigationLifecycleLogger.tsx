import { usePathname, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { createModuleLogger } from '../logging/logger';

const log = createModuleLogger('root-layout');
const MODAL_PATHS = new Set(['/parent-unlock', '/text-input-modal']);

export function RootNavigationLifecycleLogger() {
  const pathname = usePathname();
  const segments = useSegments();
  const previousPathRef = useRef<string | null>(null);
  const previousSegmentsRef = useRef<string | null>(null);

  useEffect(() => {
    log.info('Root layout initialized');
  }, []);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const currentPath = pathname ?? '/';
    const segmentPath = segments.join('/') || '(root)';
    const previousSegments = previousSegmentsRef.current;

    if (previousPath == null) {
      log.info('Navigation route entered', {
        pathname: currentPath,
        segments: segmentPath,
      });
    } else if (
      previousSegments !== segmentPath &&
      previousPath === currentPath
    ) {
      log.info('Navigation segments resolved', {
        pathname: currentPath,
        previousSegments,
        segments: segmentPath,
      });
    } else if (previousPath !== currentPath) {
      log.info('Navigation transition', {
        from: previousPath,
        pathname: currentPath,
        segments: segmentPath,
      });
    }

    if (
      previousPath &&
      MODAL_PATHS.has(previousPath) &&
      previousPath !== currentPath
    ) {
      log.info('Modal closed', {
        pathname: previousPath,
        returnedTo: currentPath,
      });
    }

    if (MODAL_PATHS.has(currentPath) && previousPath !== currentPath) {
      log.info('Modal opened', {
        from: previousPath,
        pathname: currentPath,
      });
    }

    previousPathRef.current = currentPath;
    previousSegmentsRef.current = segmentPath;
  }, [pathname, segments]);

  return null;
}
