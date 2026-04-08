import { fireEvent, render, screen } from '@testing-library/react-native';

import { ScreenBackFooter } from '../../src/components/ScreenBackFooter';
import { AppProviders } from '../../src/providers/AppProviders';

const mockBack = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

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
