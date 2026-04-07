import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { HomeScreen } from '../../../src/features/home/HomeScreen';
import { ShellSessionProvider } from '../../../src/features/shell/shellContext';
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
    mockPush.mockReset();
  });

  it('renders the empty state and opens supporting surfaces', () => {
    render(
      <SharedStoreProvider
        initialDocument={createInitialSharedDocument({ deviceId: 'home-test' })}
        storage={createMemoryStorage()}
      >
        <ShellSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <HomeScreen />
          </AppThemeProvider>
        </ShellSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Check-In')).toBeTruthy();
    expect(screen.getByText('Add Child')).toBeTruthy();
    expect(screen.getByText('Add a child to get started!')).toBeTruthy();
    expect(screen.getByText('Parent')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Open settings'));
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
        <ShellSessionProvider initialParentUnlocked={false}>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <HomeScreen />
          </AppThemeProvider>
        </ShellSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Ava')).toBeTruthy();
    expect(screen.queryByText('Unlock Parent Mode')).toBeNull();
    expect(screen.getByLabelText('Expand Ava')).toBeTruthy();
    expect(screen.queryByText('Add child')).toBeNull();

    fireEvent.press(screen.getByLabelText('Edit Ava points'));
    expect(mockPush).toHaveBeenCalledWith('/parent-unlock');

    fireEvent.press(screen.getByLabelText('Expand Ava'));
    expect(screen.getByText('Unlock Parent Mode')).toBeTruthy();
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
        <ShellSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <HomeScreen />
          </AppThemeProvider>
        </ShellSessionProvider>
      </SharedStoreProvider>,
    );

    fireEvent.press(screen.getByLabelText('Edit Ava points'));
    expect(mockPush).toHaveBeenCalledWith(
      '/edit-dialog?mode=set-points&childId=child-ava',
    );

    fireEvent.press(screen.getByLabelText('Expand Ava'));
    expect(screen.getByText('Archive')).toBeTruthy();

    fireEvent.press(screen.getByText('Archive'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Archive child',
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
        <ShellSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <HomeScreen />
          </AppThemeProvider>
        </ShellSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Parent')).toBeTruthy();
    expect(screen.queryByText('Unlocked')).toBeNull();
    expect(screen.queryByText('Add child')).toBeNull();

    fireEvent.press(screen.getByLabelText('Expand Parent'));
    expect(screen.getByText('Add child')).toBeTruthy();
  });
});
