import { fireEvent, render, screen } from '@testing-library/react-native';

import { ScreenBackFooter } from '../../src/components/ScreenBackFooter';

const mockBack = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

jest.mock('../../src/features/theme/themeContext', () => ({
  useAppTheme: () => ({
    tokens: {
      border: '#cbd5e1',
      controlSurface: '#e2e8f0',
      controlText: '#0f172a',
    },
  }),
  useThemedStyles: <T,>(
    createStyles: (theme: {
      tokens: {
        border: string;
        controlSurface: string;
        controlText: string;
      };
    }) => T,
  ) =>
    createStyles({
      tokens: {
        border: '#cbd5e1',
        controlSurface: '#e2e8f0',
        controlText: '#0f172a',
      },
    }),
}));

describe('ScreenBackFooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a back action and routes back when pressed', () => {
    render(<ScreenBackFooter />);

    fireEvent.press(screen.getByLabelText('Go Back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
