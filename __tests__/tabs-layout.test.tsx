import { describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import TabsLayout from '../app/(tabs)/_layout';

jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  const createIcon = (displayName: string) => {
    const Icon = ({ name, ...props }: { name: string }) =>
      React.createElement(
        Text,
        { ...props, accessibilityLabel: name },
        displayName,
      );

    Icon.displayName = displayName;

    return Icon;
  };

  return {
    Feather: createIcon('FeatherIcon'),
    Ionicons: createIcon('IoniconsIcon'),
    MaterialCommunityIcons: createIcon('MaterialCommunityIconsIcon'),
  };
});

const mockPush = jest.fn();
const mockParentPinModal = jest.fn();
const mockTabsScreen = jest.fn();
const mockUseAppTheme = jest.fn();

jest.mock('expo-router', () => {
  const mockReact = jest.requireActual('react') as typeof import('react');
  return {
    Tabs: Object.assign(
      ({ children }: { children: ReactNode }) =>
        mockReact.createElement(mockReact.Fragment, null, children),
      {
        Screen: (props: unknown) => {
          mockTabsScreen(props);
          return null;
        },
      },
    ),
    useRouter: () => ({
      push: mockPush,
    }),
  };
});

jest.mock('../src/components/ParentPinModal', () => ({
  ParentPinModal: (props: unknown) => {
    mockParentPinModal(props);
    return null;
  },
}));

jest.mock('../src/features/theme/themeContext', () => ({
  useAppTheme: () => mockUseAppTheme(),
}));

jest.mock('../src/features/app/appStorage', () => ({
  useAppStorage: jest.fn(),
}));

const { useAppStorage } = jest.requireMock(
  '../src/features/app/appStorage',
) as {
  useAppStorage: jest.Mock;
};

describe('TabsLayout', () => {
  it('gates the Alarm tab behind the parent PIN when parent mode is locked', () => {
    mockUseAppTheme.mockReturnValue({
      tokens: {
        border: '#cbd5e1',
        tabBarActiveBackground: '#e2e8f0',
        tabBarActiveTint: '#0f172a',
        tabBarBackground: '#f8fafc',
        tabBarInactiveTint: '#64748b',
      },
    });

    const mockUnlockParent = jest.fn((pin: string) => pin === '0000');

    useAppStorage.mockReturnValue({
      parentSession: {
        isUnlocked: false,
      },
      unlockParent: mockUnlockParent,
    });

    render(<TabsLayout />);

    const alarmScreenProps = mockTabsScreen.mock.calls
      .map(
        ([props]) =>
          props as {
            name: string;
            listeners?: {
              tabPress: (event: { preventDefault: () => void }) => void;
            };
          },
      )
      .find((props) => props.name === 'alarm');

    expect(alarmScreenProps).toBeDefined();

    const preventDefault = jest.fn();
    act(() => {
      alarmScreenProps?.listeners?.tabPress({ preventDefault });
    });

    expect(preventDefault).toHaveBeenCalled();

    const latestModalProps = mockParentPinModal.mock.calls.at(-1)?.[0] as {
      onSubmit: (pin: string) => boolean;
      visible: boolean;
    };

    expect(latestModalProps.visible).toBe(true);
    let didUnlock = false;
    act(() => {
      didUnlock = latestModalProps.onSubmit('0000');
    });
    expect(didUnlock).toBe(true);
    expect(mockUnlockParent).toHaveBeenCalledWith('0000');
    expect(mockPush).toHaveBeenCalledWith('/alarm');
  });
});
