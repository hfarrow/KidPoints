import { fireEvent, render, screen } from '@testing-library/react-native';

import { ParentUnlockModal } from '../../../src/features/parent/ParentUnlockModal';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

describe('ParentUnlockModal', () => {
  it('rejects a bad pin and accepts 0000', () => {
    render(
      <ParentSessionProvider initialParentUnlocked={false}>
        <AppThemeProvider
          initialThemeMode="light"
          storage={createMemoryStorage()}
        >
          <ParentUnlockModal />
        </AppThemeProvider>
      </ParentSessionProvider>,
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
