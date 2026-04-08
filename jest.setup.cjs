/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  const insetValues = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  return {
    SafeAreaProvider: ({ children }) =>
      React.createElement(View, null, children),
    SafeAreaView: ({ children }) => React.createElement(View, null, children),
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: insetValues,
    },
    useSafeAreaInsets: () => insetValues,
  };
});

jest.mock('react-native-keyboard-controller', () => {
  const React = require('react');
  const { View } = require('react-native');
  let keyboardListeners = {
    keyboardDidHide: new Set(),
    keyboardWillShow: new Set(),
  };

  return {
    __emitKeyboardEvent: (name, event = {}) => {
      keyboardListeners[name]?.forEach((listener) => {
        listener(event);
      });
    },
    __resetKeyboardEvents: () => {
      keyboardListeners = {
        keyboardDidHide: new Set(),
        keyboardWillShow: new Set(),
      };
    },
    KeyboardEvents: {
      addListener: (name, listener) => {
        keyboardListeners[name]?.add(listener);

        return {
          remove: () => {
            keyboardListeners[name]?.delete(listener);
          },
        };
      },
    },
    KeyboardProvider: ({ children, ...props }) =>
      React.createElement(
        View,
        { testID: props.testID ?? 'keyboard-provider', ...props },
        children,
      ),
    useKeyboardController: () => ({
      enabled: true,
      setEnabled: jest.fn(),
    }),
    useResizeMode: jest.fn(),
  };
});
