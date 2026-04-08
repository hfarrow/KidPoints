import { useEffect, useMemo, useState } from 'react';
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
  const timerViewModel = useMemo(
    () => buildSharedTimerViewModel(timerConfig, timerState, now),
    [now, timerConfig, timerState],
  );

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
