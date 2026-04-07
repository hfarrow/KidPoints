import { fireEvent, render, screen } from '@testing-library/react-native';

import { ParentUnlockScreen } from '../../../src/features/parent/ParentUnlockScreen';
import { ShellSessionProvider } from '../../../src/features/shell/shellContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

describe('ParentUnlockScreen', () => {
  it('rejects a bad pin and accepts 0000', () => {
    render(
      <ShellSessionProvider initialParentUnlocked={false}>
        <AppThemeProvider initialThemeMode="light">
          <ParentUnlockScreen />
        </AppThemeProvider>
      </ShellSessionProvider>,
    );

    fireEvent.changeText(screen.getByLabelText('Parent PIN'), '1111');
    fireEvent.press(screen.getByText('Unlock'));

    expect(
      screen.getByText('That PIN does not match the temporary parent code.'),
    ).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Parent PIN'), '0000');
    fireEvent.press(screen.getByText('Unlock'));

    expect(mockBack).toHaveBeenCalled();
  });
});
