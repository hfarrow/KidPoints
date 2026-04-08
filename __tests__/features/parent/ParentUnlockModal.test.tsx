import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ParentUnlockModal } from '../../../src/features/parent/ParentUnlockModal';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { getThemeTokens } from '../../../src/features/theme/theme';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import { createLocalSettingsStore } from '../../../src/state/localSettingsStore';
import {
  createSharedStore,
  SharedStoreProvider,
} from '../../../src/state/sharedStore';
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

function expectPinSlots(expectedDigits: ('empty' | 'masked' | string)[]) {
  expectedDigits.forEach((digit, index) => {
    const slotDigit = screen.getByTestId(`parent-pin-slot-digit-${index}`);
    const flattenedStyle = StyleSheet.flatten(slotDigit.props.style);

    if (digit === 'empty') {
      expect(slotDigit.props.children).toBeUndefined();
      expect(flattenedStyle.backgroundColor).toBeUndefined();
      return;
    }

    if (digit === 'masked') {
      expect(slotDigit.props.children).toBeUndefined();
      expect(flattenedStyle.backgroundColor).toBeTruthy();
      return;
    }

    expect(slotDigit.props.children).toBe(digit);
  });
}

function expectFilledPinSlotBorderColor(color: string) {
  for (let index = 0; index < 4; index += 1) {
    expect(
      StyleSheet.flatten(
        screen.getByTestId(`parent-pin-slot-${index}`).props.style,
      ).borderColor,
    ).toBe(color);
  }
}

function expectPinSlotBorderColor(index: number, color: string) {
  expect(
    StyleSheet.flatten(
      screen.getByTestId(`parent-pin-slot-${index}`).props.style,
    ).borderColor,
  ).toBe(color);
}

async function rehydrateSharedTransactions(
  storage: ReturnType<typeof createMemoryStorage>,
) {
  const store = createSharedStore({ storage });

  await (
    store as typeof store & {
      persist: { rehydrate: () => Promise<void> };
    }
  ).persist.rehydrate();

  return store.getState().document.transactions;
}

describe('ParentUnlockModal', () => {
  beforeEach(() => {
    keyboardControllerModule.__resetKeyboardEvents();
    mockBack.mockReset();
    mockMode = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects a bad configured pin and accepts the stored pin as soon as it is entered', async () => {
    jest.useFakeTimers();
    const accentColor = getThemeTokens('light').accent;
    const errorColor = getThemeTokens('light').critical;
    const successColor = getThemeTokens('light').success;
    const sharedStorage = createMemoryStorage();

    render(
      <SharedStoreProvider storage={sharedStorage}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppThemeProvider
            initialParentPin="2468"
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <ParentUnlockModal />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
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
    expect(
      StyleSheet.flatten(screen.getByTestId('parent-unlock-card').props.style)
        .width,
    ).toBe('92%');
    expect(
      StyleSheet.flatten(screen.getByTestId('parent-unlock-card').props.style)
        .maxWidth,
    ).toBe(360);
    expect(
      StyleSheet.flatten(screen.getByTestId('parent-pin-slot-0').props.style)
        .borderWidth,
    ).toBeGreaterThanOrEqual(2);
    expect(
      StyleSheet.flatten(
        screen.getByText(
          'Enter the parent PIN for this device to unlock parent-gated controls.',
        ).props.style,
      ).minHeight,
    ).toBe(60);

    fireEvent.changeText(screen.getByLabelText('Parent PIN'), '1111');
    expectFilledPinSlotBorderColor(errorColor);
    expectPinSlots(['masked', 'masked', 'masked', '1']);
    expect(screen.getByLabelText('Parent PIN').props.editable).toBe(true);
    expect(
      screen.queryByText(
        'Enter the parent PIN for this device to unlock parent-gated controls.',
      ),
    ).toBeNull();

    expect(
      screen.getByText(
        'That PIN does not match the parent PIN for this device.',
      ),
    ).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(901);
    });
    expectPinSlots(['empty', 'empty', 'empty', 'empty']);
    expectPinSlotBorderColor(0, accentColor);
    expect(screen.getByLabelText('Parent PIN').props.editable).toBe(true);
    expect(
      screen.getByText(
        'That PIN does not match the parent PIN for this device.',
      ),
    ).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Parent PIN'), '11');
    expectPinSlots(['masked', '1', 'empty', 'empty']);
    expect(
      screen.getByText(
        'Enter the parent PIN for this device to unlock parent-gated controls.',
      ),
    ).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Parent PIN'), '2468');
    expectFilledPinSlotBorderColor(successColor);
    expect(mockBack).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(301);
    });

    expect(mockBack).toHaveBeenCalled();

    const transactions = await rehydrateSharedTransactions(sharedStorage);

    expect(transactions).toHaveLength(2);
    expect(transactions.at(-1)?.kind).toBe('parent-unlock-succeeded');
    expect(transactions.at(-2)?.kind).toBe('parent-unlock-failed');
  });

  it('requires a new pin on fresh install and confirms it before dismissing', async () => {
    const storage = createMemoryStorage();
    const sharedStorage = createMemoryStorage();

    render(
      <SharedStoreProvider storage={sharedStorage}>
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppThemeProvider initialThemeMode="light" storage={storage}>
            <ParentUnlockModal />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
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
    expect(await rehydrateSharedTransactions(sharedStorage)).toHaveLength(0);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('parent-unlock-keyboard-frame').props.style,
      ).justifyContent,
    ).toBe('flex-end');
    expect(mockBack).toHaveBeenCalled();
  });
});
