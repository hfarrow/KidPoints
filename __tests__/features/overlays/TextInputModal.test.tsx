import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TextInputModal } from '../../../src/features/overlays/TextInputModal';
import {
  clearTextInputModal,
  presentTextInputModal,
  useTextInputModalStore,
} from '../../../src/features/overlays/textInputModalStore';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppSettingsProvider } from '../../../src/features/settings/appSettingsContext';
import { SharedStoreProvider } from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const keyboardControllerModule = jest.requireMock(
  'react-native-keyboard-controller',
) as {
  __emitKeyboardEvent: (
    name: 'keyboardDidHide' | 'keyboardWillShow',
    event?: { height?: number },
  ) => void;
  __resetKeyboardEvents: () => void;
};
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
    keyboardControllerModule.__resetKeyboardEvents();
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
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TextInputModal />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getAllByText('Edit Point Total')).toHaveLength(1);
    expect(screen.getByText('Set the exact point total for Ava.')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
    const closedStyle = StyleSheet.flatten(
      screen.getByTestId('text-input-keyboard-frame').props.style,
    );
    expect(closedStyle.justifyContent).toBe('flex-end');
    expect(closedStyle.paddingBottom).toBe(18);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('text-input-keyboard-content').props.style,
      ).opacity,
    ).toBe(1);

    act(() => {
      keyboardControllerModule.__emitKeyboardEvent('keyboardWillShow', {
        height: 240,
      });
    });

    const openStyle = StyleSheet.flatten(
      screen.getByTestId('text-input-keyboard-frame').props.style,
    );
    expect(openStyle.justifyContent).toBe('flex-end');
    expect(openStyle.paddingBottom).toBe(250);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('text-input-keyboard-content').props.style,
      ).opacity,
    ).toBe(1);

    act(() => {
      keyboardControllerModule.__emitKeyboardEvent('keyboardDidHide');
    });

    const hiddenAgainStyle = StyleSheet.flatten(
      screen.getByTestId('text-input-keyboard-frame').props.style,
    );
    expect(hiddenAgainStyle.justifyContent).toBe('flex-end');
    expect(hiddenAgainStyle.paddingBottom).toBe(250);

    fireEvent.changeText(screen.getByLabelText('Exact Point Total'), '12');
    fireEvent.press(screen.getByText('Save Total'));

    expect(onSubmit).toHaveBeenCalledWith('12');
    expect(useTextInputModalStore.getState().request).toBeNull();
  });
});
