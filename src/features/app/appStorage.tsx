import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { resolveThemeMode } from '../theme/theme';
import { appRepository } from './repository';
import {
  appDataReducer,
  createDefaultAppData,
  sortChildren,
  verifyParentPin,
} from './state';
import { computeTimerSnapshot } from './timer';
import type {
  ParentSession,
  PersistedAppData,
  ResolvedTheme,
  SharedTimerConfig,
  ThemeMode,
} from './types';

type AppStorageValue = {
  appData: PersistedAppData;
  archivedChildren: PersistedAppData['children'];
  children: PersistedAppData['children'];
  isHydrated: boolean;
  lockParent: () => void;
  parentSession: ParentSession;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  timerSnapshot: ReturnType<typeof computeTimerSnapshot>;
  themeMode: ThemeMode;
  unlockParent: (pin: string) => boolean;
  addChild: (name: string) => void;
  decrementPoints: (childId: string) => void;
  incrementPoints: (childId: string) => void;
  moveChild: (childId: string, direction: 'up' | 'down') => void;
  pauseTimer: () => void;
  renameChild: (childId: string, name: string) => void;
  archiveChild: (childId: string) => void;
  deleteChildPermanently: (childId: string) => void;
  resetTimer: () => void;
  restoreChild: (childId: string) => void;
  setPoints: (childId: string, points: number) => void;
  startTimer: () => void;
  updateTimerConfig: (patch: Partial<SharedTimerConfig>) => void;
};

const AppStorageContext = createContext<AppStorageValue | null>(null);

export function AppStorageProvider({ children }: PropsWithChildren) {
  const [appData, dispatch] = useReducer(
    appDataReducer,
    undefined,
    createDefaultAppData,
  );
  const [parentSession, setParentSession] = useState<ParentSession>({
    isUnlocked: false,
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const [now, setNow] = useState(Date.now());
  const systemColorScheme = useColorScheme();

  useEffect(() => {
    let isMounted = true;

    appRepository.load().then((loadedData) => {
      if (!isMounted) {
        return;
      }

      dispatch({ type: 'hydrate', payload: loadedData });
      setIsHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void appRepository.save(appData);
  }, [appData, isHydrated]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const value = useMemo<AppStorageValue>(() => {
    const children = sortChildren(
      appData.children.filter((child) => !child.isArchived),
    );
    const archivedChildren = [...appData.children]
      .filter((child) => child.isArchived)
      .sort((left, right) => (right.archivedAt ?? 0) - (left.archivedAt ?? 0));
    const resolvedTheme = resolveThemeMode(
      appData.uiPreferences.themeMode,
      systemColorScheme,
    );
    const timerSnapshot = computeTimerSnapshot(
      appData.timerConfig,
      appData.timerState,
      now,
    );

    return {
      appData,
      archivedChildren,
      children,
      isHydrated,
      lockParent: () => {
        setParentSession({ isUnlocked: false });
      },
      parentSession,
      resolvedTheme,
      setThemeMode: (themeMode) => {
        dispatch({ type: 'setThemeMode', themeMode });
      },
      timerSnapshot,
      themeMode: appData.uiPreferences.themeMode,
      unlockParent: (pin) => {
        const success = verifyParentPin(appData, pin);

        if (success) {
          setParentSession({ isUnlocked: true });
        }

        return success;
      },
      addChild: (name) => {
        if (!name.trim()) {
          return;
        }

        dispatch({ type: 'addChild', name });
      },
      decrementPoints: (childId) => {
        dispatch({ type: 'decrementPoints', amount: 1, childId });
      },
      incrementPoints: (childId) => {
        dispatch({ type: 'incrementPoints', amount: 1, childId });
      },
      moveChild: (childId, direction) => {
        dispatch({ type: 'moveChild', childId, direction });
      },
      pauseTimer: () => {
        dispatch({ type: 'pauseTimer', pausedAt: Date.now() });
      },
      renameChild: (childId, name) => {
        if (!name.trim()) {
          return;
        }

        dispatch({ type: 'renameChild', childId, name });
      },
      archiveChild: (childId) => {
        dispatch({ type: 'archiveChild', childId, archivedAt: Date.now() });
      },
      deleteChildPermanently: (childId) => {
        dispatch({ type: 'deleteChildPermanently', childId });
      },
      resetTimer: () => {
        dispatch({ type: 'resetTimer' });
      },
      restoreChild: (childId) => {
        dispatch({ type: 'restoreChild', childId });
      },
      setPoints: (childId, points) => {
        dispatch({ type: 'setPoints', childId, points });
      },
      startTimer: () => {
        dispatch({ type: 'startTimer', startedAt: Date.now() });
      },
      updateTimerConfig: (patch) => {
        dispatch({ type: 'updateTimerConfig', patch });
      },
    };
  }, [appData, isHydrated, now, parentSession, systemColorScheme]);

  return (
    <AppStorageContext.Provider value={value}>
      {children}
    </AppStorageContext.Provider>
  );
}

export function useAppStorage() {
  const context = useContext(AppStorageContext);

  if (!context) {
    throw new Error('useAppStorage must be used inside AppStorageProvider');
  }

  return context;
}
