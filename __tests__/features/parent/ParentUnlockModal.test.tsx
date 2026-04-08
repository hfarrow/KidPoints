import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ParentUnlockModal } from '../../../src/features/parent/ParentUnlockModal';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import { createLocalSettingsStore } from '../../../src/state/localSettingsStore';
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
const mockBack = jest.fn();
let mockMode: string | undefined;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    mode: mockMode,
  }),
  useRouter: () => ({
    back: mockBack,
  }),
}));

describe('ParentUnlockModal', () => {
  beforeEach(() => {
    keyboardControllerModule.__resetKeyboardEvents();
    mockBack.mockReset();
    mockMode = undefined;
  });

  it('rejects a bad configured pin and accepts the stored pin as soon as it is entered', () => {
    render(
      <ParentSessionProvider initialParentUnlocked={false}>
        <AppThemeProvider
          initialParentPin="2468"
          initialThemeMode="light"
          storage={createMemoryStorage()}
        >
          <ParentUnlockModal />
        </AppThemeProvider>
      </ParentSessionProvider>,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('parent-unlock-keyboard-frame').props.style,
      ).justifyContent,
    ).toBe('flex-end');
    expect(
      StyleSheet.flatten(
        screen.getByTestId('parent-unlock-keyboard-frame').props.style,
      ).paddingBottom,
    ).toBe(18);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('parent-unlock-keyboard-content').props.style,
      ).opacity,
    ).toBe(1);

    act(() => {
      keyboardControllerModule.__emitKeyboardEvent('keyboardWillShow', {
        height: 240,
      });
    });

    const openStyle = StyleSheet.flatten(
      screen.getByTestId('parent-unlock-keyboard-frame').props.style,
    );
    expect(openStyle.justifyContent).toBe('flex-end');
    expect(openStyle.paddingBottom).toBe(250);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('parent-unlock-keyboard-content').props.style,
      ).opacity,
    ).toBe(1);

    fireEvent.changeText(screen.getByLabelText('Parent PIN'), '1111');
    fireEvent.press(screen.getByText('Unlock'));

    expect(
      screen.getByText(
        'That PIN does not match the parent PIN for this device.',
      ),
    ).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Parent PIN'), '2468');

    expect(mockBack).toHaveBeenCalled();
  });

  it('requires a new pin on fresh install and confirms it before dismissing', async () => {
    const storage = createMemoryStorage();

    render(
      <ParentSessionProvider initialParentUnlocked={false}>
        <AppThemeProvider initialThemeMode="light" storage={storage}>
          <ParentUnlockModal />
        </AppThemeProvider>
      </ParentSessionProvider>,
    );

    expect(screen.getByText('Set Parent PIN')).toBeTruthy();
    expect(screen.queryByText('Cancel')).toBeNull();

    fireEvent.changeText(screen.getByLabelText('Create Parent PIN'), '1234');
    fireEvent.press(screen.getByText('Continue'));

    expect(screen.getByText('Confirm Parent PIN')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Confirm Parent PIN'), '1234');
    fireEvent.press(screen.getByText('Save PIN'));

    const rehydratedStore = createLocalSettingsStore({
      storage,
    });

    await (
      rehydratedStore as typeof rehydratedStore & {
        persist: { rehydrate: () => Promise<void> };
      }
    ).persist.rehydrate();

    expect(rehydratedStore.getState().parentPin).toBe('1234');
    expect(
      StyleSheet.flatten(
        screen.getByTestId('parent-unlock-keyboard-frame').props.style,
      ).justifyContent,
    ).toBe('flex-end');
    expect(mockBack).toHaveBeenCalled();
  });
});
