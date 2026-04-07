import type { PropsWithChildren } from 'react';

import { ShellSessionProvider } from '../features/shell/shellContext';
import { AppThemeProvider } from '../features/theme/themeContext';
import { SharedStoreProvider } from '../state/sharedStore';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SharedStoreProvider>
      <ShellSessionProvider>
        <AppThemeProvider>{children}</AppThemeProvider>
      </ShellSessionProvider>
    </SharedStoreProvider>
  );
}
