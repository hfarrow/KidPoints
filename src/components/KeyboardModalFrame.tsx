import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import {
  KeyboardEvents,
  useResizeMode,
} from 'react-native-keyboard-controller';

type KeyboardModalFrameProps = PropsWithChildren<{
  contentTestID?: string;
  hideUntilKeyboardPositioned?: boolean;
  initialVerticalPosition?: 'bottom' | 'center';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

const CLOSED_MODAL_PADDING = 18;
const OPEN_MODAL_GAP = 10;

export function getKeyboardModalFrameStyle(
  keyboardHeight: number,
  shouldUseBottomPlacement: boolean,
) {
  const hasKeyboardHeight = keyboardHeight > 0;

  return {
    justifyContent: shouldUseBottomPlacement ? 'flex-end' : 'center',
    paddingBottom:
      shouldUseBottomPlacement && hasKeyboardHeight
        ? keyboardHeight + OPEN_MODAL_GAP
        : CLOSED_MODAL_PADDING,
  } as const;
}

export function KeyboardModalFrame({
  children,
  contentTestID,
  hideUntilKeyboardPositioned = true,
  initialVerticalPosition = 'center',
  style,
  testID,
}: KeyboardModalFrameProps) {
  useResizeMode();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [hasPositionedForKeyboard, setHasPositionedForKeyboard] =
    useState(false);

  useEffect(() => {
    const willShowSubscription = KeyboardEvents.addListener(
      'keyboardWillShow',
      (event) => {
        setKeyboardHeight(event.height);
        setHasPositionedForKeyboard(true);
      },
    );
    const didHideSubscription = KeyboardEvents.addListener(
      'keyboardDidHide',
      () => {
        // Preserve the final keyboard-aligned position for the life of the modal
        // so it doesn't jump back to center while closing or after manual dismiss.
      },
    );

    return () => {
      willShowSubscription.remove();
      didHideSubscription.remove();
    };
  }, []);

  const shouldUseBottomPlacement =
    initialVerticalPosition === 'bottom' || hasPositionedForKeyboard;
  const keyboardLayoutStyle = useMemo(
    () => getKeyboardModalFrameStyle(keyboardHeight, shouldUseBottomPlacement),
    [keyboardHeight, shouldUseBottomPlacement],
  );
  const contentStyle =
    !hideUntilKeyboardPositioned || hasPositionedForKeyboard
      ? styles.contentVisible
      : styles.contentHidden;

  return (
    <View style={[styles.frame, keyboardLayoutStyle, style]} testID={testID}>
      <View style={contentStyle} testID={contentTestID}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: CLOSED_MODAL_PADDING,
    paddingTop: CLOSED_MODAL_PADDING,
  },
  contentHidden: {
    alignItems: 'center',
    opacity: 0,
    width: '100%',
  },
  contentVisible: {
    alignItems: 'center',
    opacity: 1,
    width: '100%',
  },
});
