import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ScreenBackFooter } from '../../src/components/ScreenBackFooter';
import { AppProviders } from '../../src/providers/AppProviders';

const mockBack = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');

  return {
    SafeAreaProvider: ({ children }: { children: ReactNode }) => (
      <View>{children}</View>
    ),
    initialWindowMetrics: {
      frame: { height: 800, width: 400, x: 0, y: 0 },
      insets: { bottom: 0, left: 0, right: 0, top: 0 },
    },
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

describe('ScreenBackFooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a back action and routes back when pressed', () => {
    render(
      <AppProviders>
        <ScreenBackFooter />
      </AppProviders>,
    );

    fireEvent.press(screen.getByLabelText('Go Back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
