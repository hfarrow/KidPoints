import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { ListBrowserScreen } from '../../../src/features/overlays/ListBrowserScreen';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import {
  createInitialSharedDocument,
  createSharedStore,
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
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'archived-list',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Noah').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];
    expect(store.getState().setPoints(childId, 12).ok).toBe(true);
    expect(store.getState().archiveChild(childId).ok).toBe(true);
    const document = store.getState().document;

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
    expect(screen.getByLabelText('Go Back')).toBeTruthy();

    fireEvent.press(screen.getByText('Delete Permanently'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Child Permanently',
      expect.stringContaining('removed forever'),
      expect.any(Array),
    );

    fireEvent.press(screen.getByLabelText('Go Back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
