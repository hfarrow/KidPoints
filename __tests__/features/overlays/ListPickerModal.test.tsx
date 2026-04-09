import { fireEvent, render, screen } from '@testing-library/react-native';

import { ListPickerModal } from '../../../src/features/overlays/ListPickerModal';
import {
  clearListPickerModal,
  presentListPickerModal,
} from '../../../src/features/overlays/listPickerModalStore';
import { AppSettingsProvider } from '../../../src/features/settings/appSettingsContext';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

let mockPathname = '/';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

describe('ListPickerModal', () => {
  beforeEach(() => {
    clearListPickerModal();
    mockPathname = '/';
  });

  afterEach(() => {
    clearListPickerModal();
  });

  it('supports multi-toggle selection and closes only when asked', () => {
    const onSelect = jest.fn();

    presentListPickerModal({
      items: [
        { id: 'alpha', label: 'alpha' },
        { id: 'beta', label: 'beta' },
      ],
      closeLabel: 'Close',
      onSelect,
      selectedItemIds: ['alpha'],
      selectionMode: 'multiple',
      title: 'Filter Namespaces',
    });

    render(
      <AppSettingsProvider
        initialThemeMode="light"
        storage={createMemoryStorage()}
      >
        <ListPickerModal />
      </AppSettingsProvider>,
    );

    expect(screen.getByText('Filter Namespaces')).toBeTruthy();
    expect(screen.getByLabelText('Selected alpha')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Select beta'));

    expect(onSelect).toHaveBeenCalledWith('beta');
    expect(screen.getByText('Filter Namespaces')).toBeTruthy();
    expect(screen.getByLabelText('Selected beta')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Selected alpha'));

    expect(onSelect).toHaveBeenCalledWith('alpha');
    expect(screen.getByLabelText('Select alpha')).toBeTruthy();

    fireEvent.press(screen.getByText('Close'));

    expect(screen.queryByText('Filter Namespaces')).toBeNull();
  });
});
