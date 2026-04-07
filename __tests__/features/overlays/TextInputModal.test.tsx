import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextInputModal } from '../../../src/features/overlays/TextInputModal';
import {
  clearTextInputModal,
  presentTextInputModal,
} from '../../../src/features/overlays/textInputModalStore';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

describe('TextInputModal', () => {
  beforeEach(() => {
    clearTextInputModal();
    mockBack.mockReset();
    mockPush.mockReset();
  });

  it('renders caller-provided copy and submits the current text', () => {
    const onSubmit = jest.fn(() => ({ ok: true as const }));

    presentTextInputModal({
      confirmLabel: 'Save Total',
      description: 'Set the exact point total for Ava.',
      initialValue: '4',
      inputAccessibilityLabel: 'Exact Point Total',
      keyboardType: 'number-pad',
      onSubmit,
      placeholder: '0',
      title: 'Edit Point Total',
    });

    render(
      <ParentSessionProvider initialParentUnlocked>
        <AppThemeProvider
          initialThemeMode="light"
          storage={createMemoryStorage()}
        >
          <TextInputModal />
        </AppThemeProvider>
      </ParentSessionProvider>,
    );

    expect(screen.getAllByText('Edit Point Total')).toHaveLength(1);
    expect(screen.getByText('Set the exact point total for Ava.')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Exact Point Total'), '12');
    fireEvent.press(screen.getByText('Save Total'));

    expect(onSubmit).toHaveBeenCalledWith('12');
    expect(mockBack).toHaveBeenCalled();
  });
});
