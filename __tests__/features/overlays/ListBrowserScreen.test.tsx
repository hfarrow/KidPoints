import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { ListBrowserScreen } from '../../../src/features/overlays/ListBrowserScreen';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import {
  createInitialSharedDocument,
  SharedStoreProvider,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockBack = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const mockReactNative = jest.requireActual('react-native');
  const { Text } = mockReactNative;

  function MockIcon() {
    return <Text>icon</Text>;
  }

  return {
    Feather: MockIcon,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

describe('ListBrowserScreen', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockBack.mockReset();
  });

  it('shows restore and permanent delete actions for archived children', () => {
    const document = createInitialSharedDocument({ deviceId: 'archived-list' });
    const child = {
      archivedAt: undefined,
      createdAt: '2026-04-06T08:00:00.000Z',
      id: 'child-noah',
      name: 'Noah',
      points: 12,
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
      {
        deviceId: document.deviceId,
        eventId: `${document.deviceId}-2`,
        occurredAt: '2026-04-06T09:00:00.000Z',
        payload: { childId: child.id },
        sequence: 2,
        type: 'child.archived' as const,
      },
    ];
    document.nextSequence = 3;

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
            <ListBrowserScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Noah')).toBeTruthy();
    expect(screen.getByText('Restore to Home')).toBeTruthy();
    expect(screen.getByText('Delete Permanently')).toBeTruthy();
    expect(screen.getByLabelText('Go back')).toBeTruthy();

    fireEvent.press(screen.getByText('Delete Permanently'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete child permanently',
      expect.stringContaining('removed forever'),
      expect.any(Array),
    );

    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
