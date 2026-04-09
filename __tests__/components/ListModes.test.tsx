import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ActionList } from '../../src/components/ActionList';
import { MultiSelectList } from '../../src/components/MultiSelectList';
import { SingleSelectList } from '../../src/components/SingleSelectList';
import { AppSettingsProvider } from '../../src/features/settings/appSettingsContext';
import { createMemoryStorage } from '../testUtils/memoryStorage';

const listItems = [
  { detail: 'First detail', id: 'ava', name: 'Ava' },
  { detail: 'Second detail', id: 'milo', name: 'Milo' },
];

describe('List mode components', () => {
  function renderWithSettings(children: ReactNode) {
    return render(
      <AppSettingsProvider
        initialThemeMode="light"
        storage={createMemoryStorage()}
      >
        {children}
      </AppSettingsProvider>,
    );
  }

  it('renders controlled single-select rows and calls onSelect with the chosen item', () => {
    const onSelect = jest.fn();

    renderWithSettings(
      <SingleSelectList
        getItemDescription={(item) => item.detail}
        getItemLabel={(item) => item.name}
        items={listItems}
        keyExtractor={(item) => item.id}
        onRequestClose={jest.fn()}
        onSelect={onSelect}
        selectedItemId="ava"
        title="Pick a Child"
        visible
      />,
    );

    expect(screen.getByText('Selected')).toBeTruthy();

    fireEvent.press(screen.getByText('Milo'));

    expect(onSelect).toHaveBeenCalledWith(listItems[1], 1);
  });

  it('renders controlled multi-select rows and calls onToggle for each tapped item', () => {
    const onToggle = jest.fn();

    renderWithSettings(
      <MultiSelectList
        getItemDescription={(item) => item.detail}
        getItemLabel={(item) => item.name}
        items={listItems}
        keyExtractor={(item) => item.id}
        onRequestClose={jest.fn()}
        onToggle={onToggle}
        selectedItemIds={['ava']}
        title="Filter Children"
        visible
      />,
    );

    expect(screen.getByText('Included')).toBeTruthy();

    fireEvent.press(screen.getByText('Milo'));

    expect(onToggle).toHaveBeenCalledWith(listItems[1], 1);
  });

  it('renders arbitrary custom rows through ActionList', () => {
    renderWithSettings(
      <ActionList
        items={listItems}
        keyExtractor={(item) => item.id}
        onRequestClose={jest.fn()}
        renderItem={({ item }) => (
          <View>
            <Text>{item.name}</Text>
            <Text>{item.detail}</Text>
            <Text>Extra Row Content</Text>
          </View>
        )}
        title="Archived Children"
        visible
      />,
    );

    expect(screen.getByText('Ava')).toBeTruthy();
    expect(screen.getByText('First detail')).toBeTruthy();
    expect(screen.getAllByText('Extra Row Content')).toHaveLength(2);
  });
});
