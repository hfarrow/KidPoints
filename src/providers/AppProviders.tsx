import type { PropsWithChildren } from 'react';

import { ParentSessionProvider } from '../features/parent/parentSessionContext';
import { AppThemeProvider } from '../features/theme/themeContext';
import { SharedStoreProvider } from '../state/sharedStore';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SharedStoreProvider>
      <ParentSessionProvider>
        <AppThemeProvider>{children}</AppThemeProvider>
      </ParentSessionProvider>
    </SharedStoreProvider>
  );
}
