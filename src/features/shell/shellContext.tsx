import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from 'react';

export const DEFAULT_PARENT_PIN = '0000';

type ShellSessionContextValue = {
  attemptUnlock: (pin: string) => boolean;
  isParentUnlocked: boolean;
  lockParentMode: () => void;
  unlockParentMode: () => void;
};

const ShellSessionContext = createContext<ShellSessionContextValue | null>(
  null,
);

type ShellSessionProviderProps = PropsWithChildren<{
  initialParentUnlocked?: boolean;
}>;

function getDefaultParentUnlocked() {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
}

export function ShellSessionProvider({
  children,
  initialParentUnlocked,
}: ShellSessionProviderProps) {
  const [isParentUnlocked, setIsParentUnlocked] = useState(
    initialParentUnlocked ?? getDefaultParentUnlocked(),
  );

  const value = useMemo<ShellSessionContextValue>(
    () => ({
      attemptUnlock: (pin) => {
        const didUnlock = pin === DEFAULT_PARENT_PIN;

        if (didUnlock) {
          setIsParentUnlocked(true);
        }

        return didUnlock;
      },
      isParentUnlocked,
      lockParentMode: () => {
        setIsParentUnlocked(false);
      },
      unlockParentMode: () => {
        setIsParentUnlocked(true);
      },
    }),
    [isParentUnlocked],
  );

  return (
    <ShellSessionContext.Provider value={value}>
      {children}
    </ShellSessionContext.Provider>
  );
}

export function useShellSession() {
  const value = useContext(ShellSessionContext);

  if (!value) {
    throw new Error('useShellSession must be used within ShellSessionProvider');
  }

  return value;
}
