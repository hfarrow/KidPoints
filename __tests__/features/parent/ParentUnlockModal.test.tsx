import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import * as appHaptics from '../../../src/features/haptics/appHaptics';
import {
  ParentUnlockModal,
  schedulePinInputFocus,
} from '../../../src/features/parent/ParentUnlockModal';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppSettingsProvider } from '../../../src/features/settings/appSettingsContext';
import { getThemeTokens } from '../../../src/features/theme/theme';
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
const scheduleAfterFrameCommitModule = jest.requireMock(
  '../../../src/timing/scheduleAfterFrameCommit',
) as {
  scheduleAfterFrameCommit: jest.Mock;
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
jest.mock('../../../src/timing/scheduleAfterFrameCommit', () => ({
  scheduleAfterFrameCommit: jest.fn(() => jest.fn()),
}));
jest.mock('../../../src/features/haptics/appHaptics', () => ({
  triggerErrorHaptic: jest.fn(),
  triggerLightImpactHaptic: jest.fn(),
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
    scheduleAfterFrameCommitModule.scheduleAfterFrameCommit.mockClear();
    jest.clearAllMocks();
    mockBack.mockReset();
    mockMode = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries focusing the pin input once when the initial focus does not stick', () => {
    jest.useFakeTimers();
    const cancelScheduledFocus = jest.fn();
    const focus = jest.fn();
    const isFocused = jest
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    scheduleAfterFrameCommitModule.scheduleAfterFrameCommit.mockImplementation(
      (callback: () => void) => {
        callback();
        return cancelScheduledFocus;
      },
    );

    const cancelFocus = schedulePinInputFocus({
      current: {
        focus,
        isFocused,
      },
    } as never);

    expect(focus).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(focus).toHaveBeenCalledTimes(2);

    cancelFocus();
    expect(cancelScheduledFocus).toHaveBeenCalledTimes(1);
  });

  it('rejects a bad configured pin and accepts the stored pin as soon as it is entered', async () => {
    jest.useFakeTimers();
    const accentColor = getThemeTokens('default', 'light').accent;
    const errorColor = getThemeTokens('default', 'light').critical;
    const successColor = getThemeTokens('default', 'light').success;
    const sharedStorage = createMemoryStorage();

    render(
      <SharedStoreProvider storage={sharedStorage}>
        <ParentSessionProvider
          initialParentUnlocked={false}
          storage={createMemoryStorage()}
        >
          <AppSettingsProvider
            initialParentPin="2468"
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <ParentUnlockModal />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );
    expect(
      scheduleAfterFrameCommitModule.scheduleAfterFrameCommit,
    ).toHaveBeenCalledTimes(1);

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
        <ParentSessionProvider
          initialParentUnlocked={false}
          storage={createMemoryStorage()}
        >
          <AppSettingsProvider initialThemeMode="light" storage={storage}>
            <ParentUnlockModal />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );
    expect(
      scheduleAfterFrameCommitModule.scheduleAfterFrameCommit,
    ).toHaveBeenCalledTimes(1);

    expect(screen.getByText('Set Parent PIN')).toBeTruthy();
    expect(screen.queryByText('Cancel')).toBeNull();

    fireEvent.changeText(screen.getByLabelText('Create Parent PIN'), '1234');
    fireEvent.press(screen.getByText('Continue'));
    expect(
      scheduleAfterFrameCommitModule.scheduleAfterFrameCommit,
    ).toHaveBeenCalledTimes(2);

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

  it('plays light haptics for each entered digit and an error haptic for an incorrect unlock pin', () => {
    jest.useFakeTimers();

    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider
          initialParentUnlocked={false}
          storage={createMemoryStorage()}
        >
          <AppSettingsProvider
            initialHapticsEnabled={true}
            initialParentPin="2468"
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <ParentUnlockModal />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    const pinInput = screen.getByLabelText('Parent PIN');

    fireEvent.changeText(pinInput, '1');
    fireEvent.changeText(pinInput, '11');
    fireEvent.changeText(pinInput, '111');
    fireEvent.changeText(pinInput, '1111');

    expect(appHaptics.triggerLightImpactHaptic).toHaveBeenCalledTimes(4);
    expect(appHaptics.triggerLightImpactHaptic).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(appHaptics.triggerErrorHaptic).toHaveBeenCalledWith(true);
  });

  it('does not trigger parent pin haptics when the global setting is disabled', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider
          initialParentUnlocked={false}
          storage={createMemoryStorage()}
        >
          <AppSettingsProvider
            initialHapticsEnabled={false}
            initialParentPin="2468"
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <ParentUnlockModal />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    const pinInput = screen.getByLabelText('Parent PIN');

    fireEvent.changeText(pinInput, '1');
    fireEvent.changeText(pinInput, '11');
    fireEvent.changeText(pinInput, '111');
    fireEvent.changeText(pinInput, '1111');

    expect(appHaptics.triggerLightImpactHaptic).toHaveBeenCalledWith(false);
    expect(appHaptics.triggerErrorHaptic).toHaveBeenCalledWith(false);
  });

  it('re-focuses the setup input after a mismatched confirmation resets the flow', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider
          initialParentUnlocked={false}
          storage={createMemoryStorage()}
        >
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <ParentUnlockModal />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );
    expect(
      scheduleAfterFrameCommitModule.scheduleAfterFrameCommit,
    ).toHaveBeenCalledTimes(1);

    fireEvent.changeText(screen.getByLabelText('Create Parent PIN'), '1234');
    fireEvent.press(screen.getByText('Continue'));
    expect(
      scheduleAfterFrameCommitModule.scheduleAfterFrameCommit,
    ).toHaveBeenCalledTimes(2);

    fireEvent.changeText(screen.getByLabelText('Confirm Parent PIN'), '9999');
    fireEvent.press(screen.getByText('Save PIN'));
    expect(
      scheduleAfterFrameCommitModule.scheduleAfterFrameCommit,
    ).toHaveBeenCalledTimes(3);

    expect(screen.getByText('Set Parent PIN')).toBeTruthy();
    expect(
      screen.getByText(
        'Those PINs did not match. Enter a new PIN to try again.',
      ),
    ).toBeTruthy();
  });
});
