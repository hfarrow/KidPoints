import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler, Text } from 'react-native';

import { ListScaffold } from '../../src/components/ListScaffold';
import { AppSettingsProvider } from '../../src/features/settings/appSettingsContext';
import { createMemoryStorage } from '../testUtils/memoryStorage';

describe('ListScaffold', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders content only when visible and closes from the built-in affordances', () => {
    const onRequestClose = jest.fn();
    const addEventListenerSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_eventName, handler) => {
        return {
          remove: jest.fn(),
          handler,
        } as unknown as { remove: () => void };
      });

    const { rerender } = render(
      <AppSettingsProvider
        initialThemeMode="light"
        storage={createMemoryStorage()}
      >
        <ListScaffold
          onRequestClose={onRequestClose}
          title="Archived Children"
          visible={false}
        >
          <Text>Noah</Text>
        </ListScaffold>
      </AppSettingsProvider>,
    );

    expect(screen.queryByText('Archived Children')).toBeNull();
    expect(addEventListenerSpy).not.toHaveBeenCalled();

    rerender(
      <AppSettingsProvider
        initialThemeMode="light"
        storage={createMemoryStorage()}
      >
        <ListScaffold
          onRequestClose={onRequestClose}
          subtitle="Restore archived children from this overlay."
          title="Archived Children"
          visible
        >
          <Text>Noah</Text>
        </ListScaffold>
      </AppSettingsProvider>,
    );

    expect(screen.getByText('Archived Children')).toBeTruthy();
    expect(
      screen.getByText('Restore archived children from this overlay.'),
    ).toBeTruthy();
    expect(screen.getByText('Noah')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Close Archived Children'));
    fireEvent.press(screen.getByLabelText('Dismiss Archived Children'));

    expect(onRequestClose).toHaveBeenCalledTimes(2);
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    );
  });

  it('renders the empty state when no children are provided', () => {
    render(
      <AppSettingsProvider
        initialThemeMode="light"
        storage={createMemoryStorage()}
      >
        <ListScaffold
          emptyState={<Text>Nothing archived yet.</Text>}
          onRequestClose={jest.fn()}
          title="Archived Children"
          visible
        />
      </AppSettingsProvider>,
    );

    expect(screen.getByText('Nothing archived yet.')).toBeTruthy();
  });
});
