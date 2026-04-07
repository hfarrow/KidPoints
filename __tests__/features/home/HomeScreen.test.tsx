import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { HomeScreen } from '../../../src/features/home/HomeScreen';
import {
  clearTextInputModal,
  useTextInputModalStore,
} from '../../../src/features/overlays/textInputModalStore';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import {
  createInitialSharedDocument,
  SharedStoreProvider,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockPush = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const mockReactNative = jest.requireActual('react-native');
  const { Text } = mockReactNative;

  function MockIcon() {
    return <Text>icon</Text>;
  }

  return {
    Feather: MockIcon,
    Ionicons: MockIcon,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    clearTextInputModal();
    mockPush.mockReset();
  });

  it('renders the empty state and opens supporting surfaces', () => {
    render(
      <SharedStoreProvider
        initialDocument={createInitialSharedDocument({ deviceId: 'home-test' })}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <HomeScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Check-In')).toBeTruthy();
    expect(screen.getAllByText('Add Child')).toHaveLength(2);
    expect(screen.getByText('Add a child to get started!')).toBeTruthy();
    expect(screen.getByText('Parent')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Open Settings'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('renders active children and keeps mutations gated when locked', () => {
    const document = createInitialSharedDocument({ deviceId: 'home-locked' });
    const child = {
      archivedAt: undefined,
      createdAt: '2026-04-06T08:00:00.000Z',
      id: 'child-ava',
      name: 'Ava',
      points: 4,
      status: 'active' as const,
      updatedAt: '2026-04-06T08:00:00.000Z',
    };

    document.events = [
      {
        deviceId: document.deviceId,
        eventId: `${document.deviceId}-1`,
        occurredAt: '2026-04-06T08:00:00.000Z',
        payload: { child },
        sequence: 1,
        type: 'child.created' as const,
      },
    ];
    document.nextSequence = 2;

    render(
      <SharedStoreProvider
        initialDocument={document}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <HomeScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Ava')).toBeTruthy();
    expect(screen.queryByText('Unlock Parent Mode')).toBeNull();
    expect(screen.queryByLabelText('Expand Ava')).toBeNull();
    expect(screen.queryByText('Add Child')).toBeNull();

    fireEvent.press(screen.getByLabelText('Edit Ava points'));
    expect(mockPush).toHaveBeenCalledWith('/parent-unlock');
  });

  it('opens exact points editing from the points capsule and confirms archive inside the expanded tile', () => {
    const document = createInitialSharedDocument({ deviceId: 'home-unlocked' });
    const child = {
      archivedAt: undefined,
      createdAt: '2026-04-06T08:00:00.000Z',
      id: 'child-ava',
      name: 'Ava',
      points: 4,
      status: 'active' as const,
      updatedAt: '2026-04-06T08:00:00.000Z',
    };

    document.events = [
      {
        deviceId: document.deviceId,
        eventId: `${document.deviceId}-1`,
        occurredAt: '2026-04-06T08:00:00.000Z',
        payload: { child },
        sequence: 1,
        type: 'child.created' as const,
      },
    ];
    document.nextSequence = 2;

    render(
      <SharedStoreProvider
        initialDocument={document}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <HomeScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    fireEvent.press(screen.getByLabelText('Edit Ava points'));
    expect(mockPush).toHaveBeenCalledWith('/text-input-modal');
    expect(useTextInputModalStore.getState().request).toMatchObject({
      confirmLabel: 'Save Total',
      description: 'Set the exact point total for Ava.',
      initialValue: '4',
      inputAccessibilityLabel: 'Exact Point Total',
      title: 'Edit Point Total',
    });

    fireEvent.press(screen.getByLabelText('Expand Ava'));
    expect(screen.getByText('Archive')).toBeTruthy();

    fireEvent.press(screen.getByText('Archive'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Archive Child',
      expect.stringContaining('removed from Home'),
      expect.any(Array),
    );
  });

  it('keeps parent tools collapsed by default without an unlocked badge', () => {
    const document = createInitialSharedDocument({ deviceId: 'home-parent' });
    const child = {
      archivedAt: undefined,
      createdAt: '2026-04-06T08:00:00.000Z',
      id: 'child-parent',
      name: 'Milo',
      points: 2,
      status: 'active' as const,
      updatedAt: '2026-04-06T08:00:00.000Z',
    };

    document.events = [
      {
        deviceId: document.deviceId,
        eventId: `${document.deviceId}-1`,
        occurredAt: '2026-04-06T08:00:00.000Z',
        payload: { child },
        sequence: 1,
        type: 'child.created' as const,
      },
    ];
    document.nextSequence = 2;

    render(
      <SharedStoreProvider
        initialDocument={document}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <HomeScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Parent')).toBeTruthy();
    expect(screen.queryByText('Unlocked')).toBeNull();
    expect(screen.queryByText('Add Child')).toBeNull();

    fireEvent.press(screen.getByText('Parent'));
    expect(screen.getByText('Add Child')).toBeTruthy();
  });
});
