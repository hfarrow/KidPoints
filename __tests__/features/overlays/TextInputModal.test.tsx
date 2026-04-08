import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextInputModal } from '../../../src/features/overlays/TextInputModal';
import {
  clearTextInputModal,
  presentTextInputModal,
  useTextInputModalStore,
} from '../../../src/features/overlays/textInputModalStore';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockPush = jest.fn();
let mockPathname = '/';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('TextInputModal', () => {
  beforeEach(() => {
    clearTextInputModal();
    mockPush.mockReset();
    mockPathname = '/';
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
    expect(screen.getByTestId('text-input-keyboard-frame').props.behavior).toBe(
      'height',
    );

    fireEvent.changeText(screen.getByLabelText('Exact Point Total'), '12');
    fireEvent.press(screen.getByText('Save Total'));

    expect(onSubmit).toHaveBeenCalledWith('12');
    expect(useTextInputModalStore.getState().request).toBeNull();
  });
});
