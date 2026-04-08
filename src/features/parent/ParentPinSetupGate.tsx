import { useEffect, useRef } from 'react';

import { createModuleLogger } from '../../logging/logger';
import { useStartupNavigationRequest } from '../../navigation/startupNavigationStore';
import { useLocalSettingsStore } from '../../state/localSettingsStore';

const log = createModuleLogger('parent-pin-setup-gate');

export function ParentPinSetupGate() {
  const hasHydrated = useLocalSettingsStore((state) => state.hasHydrated);
  const parentPin = useLocalSettingsStore((state) => state.parentPin);
  const hasLoggedRequiredRef = useRef(false);
  const needsParentPinSetup = hasHydrated && !parentPin;

  useEffect(() => {
    if (!needsParentPinSetup) {
      hasLoggedRequiredRef.current = false;
      return;
    }

    if (hasLoggedRequiredRef.current) {
      return;
    }

    hasLoggedRequiredRef.current = true;
    log.info('Parent PIN setup required');
  }, [needsParentPinSetup]);

  useStartupNavigationRequest({
    enabled: needsParentPinSetup,
    href: '/parent-unlock?mode=setup',
    id: 'parent-pin-setup',
    source: 'parent-pin-setup-gate',
    targetPathname: '/parent-unlock',
  });

  return null;
}
