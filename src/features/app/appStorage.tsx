import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { resolveThemeMode } from '../theme/theme';
import { appRepository } from './repository';
import { appDataReducer, sortChildren, verifyParentPin } from './state';
import { computeTimerSnapshot } from './timer';
import {
  commitSharedTransaction,
  createDefaultAppDocument,
  getRevertPlan,
  getTransactionActorDeviceName,
  revertTransaction as revertSharedTransaction,
  type TransactionRecord,
} from './transactions';
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
  transactions: TransactionRecord[];
  clearTransactionHistory: () => void;
  getRevertPlan: (transactionId: number) => number[];
  revertTransaction: (transactionId: number) => void;
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
  const [document, setDocument] = useState(createDefaultAppDocument);
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

      setDocument(loadedData);
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

    void appRepository.save(document);
  }, [document, isHydrated]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const value = useMemo<AppStorageValue>(() => {
    const appData = document.head;
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
    const actorDeviceName = getTransactionActorDeviceName();
    const commit = (intent: Parameters<typeof commitSharedTransaction>[1]) => {
      setDocument((current) =>
        commitSharedTransaction(current, intent, {
          actorDeviceName,
          occurredAt: Date.now(),
        }),
      );
    };

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
        setDocument((current) => ({
          ...current,
          head: appDataReducer(current.head, {
            type: 'setThemeMode',
            themeMode,
          }),
        }));
      },
      timerSnapshot,
      themeMode: appData.uiPreferences.themeMode,
      transactions: [...document.transactionState.transactions],
      clearTransactionHistory: () => {
        setDocument((current) => ({
          ...current,
          transactionState: {
            nextTransactionId: 1,
            transactions: [],
          },
        }));
      },
      getRevertPlan: (transactionId) =>
        getRevertPlan(document.transactionState, transactionId).transactionIds,
      revertTransaction: (transactionId) => {
        setDocument((current) =>
          revertSharedTransaction(current, transactionId, {
            actorDeviceName,
            occurredAt: Date.now(),
          }),
        );
      },
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

        commit({ type: 'addChild', name });
      },
      decrementPoints: (childId) => {
        commit({ type: 'decrementPoints', amount: 1, childId });
      },
      incrementPoints: (childId) => {
        commit({ type: 'incrementPoints', amount: 1, childId });
      },
      moveChild: (childId, direction) => {
        commit({ type: 'moveChild', childId, direction });
      },
      pauseTimer: () => {
        commit({ type: 'pauseTimer', pausedAt: Date.now() });
      },
      renameChild: (childId, name) => {
        if (!name.trim()) {
          return;
        }

        commit({ type: 'renameChild', childId, name });
      },
      archiveChild: (childId) => {
        commit({ type: 'archiveChild', childId, archivedAt: Date.now() });
      },
      deleteChildPermanently: (childId) => {
        commit({ type: 'deleteChildPermanently', childId });
      },
      resetTimer: () => {
        commit({ type: 'resetTimer' });
      },
      restoreChild: (childId) => {
        commit({ type: 'restoreChild', childId });
      },
      setPoints: (childId, points) => {
        commit({ type: 'setPoints', childId, points });
      },
      startTimer: () => {
        commit({ type: 'startTimer', startedAt: Date.now() });
      },
      updateTimerConfig: (patch) => {
        setDocument((current) => ({
          ...current,
          head: appDataReducer(current.head, {
            type: 'updateTimerConfig',
            patch,
          }),
        }));
      },
    };
  }, [document, isHydrated, now, parentSession, systemColorScheme]);

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
