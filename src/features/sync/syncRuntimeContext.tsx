import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from 'react';
import {
  createNativeNearbySyncRuntime,
  type NearbySyncRuntime,
} from './nearbySyncRuntime';

const defaultNearbySyncRuntime = createNativeNearbySyncRuntime();

const SyncRuntimeContext = createContext<NearbySyncRuntime | null>(null);

export function SyncRuntimeProvider({
  children,
  runtime,
}: PropsWithChildren<{
  runtime: NearbySyncRuntime;
}>) {
  const stableRuntime = useMemo(() => runtime, [runtime]);

  return (
    <SyncRuntimeContext.Provider value={stableRuntime}>
      {children}
    </SyncRuntimeContext.Provider>
  );
}

export function useSyncRuntime() {
  return useContext(SyncRuntimeContext) ?? defaultNearbySyncRuntime;
}
