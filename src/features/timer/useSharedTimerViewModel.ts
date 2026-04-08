import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  selectSharedTimerConfig,
  selectSharedTimerState,
  useSharedStore,
} from '../../state/sharedStore';
import { buildSharedTimerViewModel } from '../../state/sharedTimer';

export function useSharedTimerViewModel() {
  const timerConfig = useSharedStore(selectSharedTimerConfig);
  const timerState = useSharedStore(selectSharedTimerState);
  const [now, setNow] = useState(() => Date.now());
  const syncKey = useMemo(
    () =>
      [
        timerConfig.alarmDurationSeconds,
        timerConfig.intervalMinutes,
        timerConfig.intervalSeconds,
        timerState.cycleStartedAt ?? 'none',
        timerState.mode,
        timerState.pausedRemainingMs ?? 'none',
      ].join('|'),
    [timerConfig, timerState],
  );
  const previousSyncKeyRef = useRef(syncKey);
  const timerViewModel = useMemo(
    () => buildSharedTimerViewModel(timerConfig, timerState, now),
    [now, timerConfig, timerState],
  );

  useEffect(() => {
    if (previousSyncKeyRef.current === syncKey) {
      return;
    }

    previousSyncKeyRef.current = syncKey;
    setNow(Date.now());
  }, [syncKey]);

  useEffect(() => {
    if (timerViewModel.status !== 'running') {
      return;
    }

    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => {
      clearInterval(intervalId);
    };
  }, [timerViewModel.status]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setNow(Date.now());
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return timerViewModel;
}
