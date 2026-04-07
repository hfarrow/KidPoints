import type { PropsWithChildren } from 'react';

import { ShellSessionProvider } from '../features/shell/shellContext';
import { AppThemeProvider } from '../features/theme/themeContext';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ShellSessionProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </ShellSessionProvider>
  );
}
