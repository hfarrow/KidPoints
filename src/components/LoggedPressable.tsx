import { type ReactNode, useRef } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { createModuleLogger } from '../logging/logger';

type LoggedPressableProps = Omit<
  PressableProps,
  'children' | 'onPress' | 'style'
> & {
  children: ReactNode;
  disablePressDebounce?: boolean;
  disableLogging?: boolean;
  logContext?: Record<string, unknown>;
  logLabel: string;
  onPress?: () => void;
  pressDebounceMs?: number;
  style?: StyleProp<ViewStyle>;
};

const log = createModuleLogger('pressable');
const lastAcceptedPressByActionKey = new Map<string, number>();

export function resetLoggedPressableDebounceForTests() {
  lastAcceptedPressByActionKey.clear();
}

export function LoggedPressable({
  accessibilityLabel,
  accessibilityRole = 'button',
  children,
  disablePressDebounce = false,
  disableLogging = false,
  logContext,
  logLabel,
  onPress,
  pressDebounceMs = 0,
  style,
  ...rest
}: LoggedPressableProps) {
  const actionKeyRef = useRef(`${accessibilityLabel ?? ''}::${logLabel}`);
  actionKeyRef.current = `${accessibilityLabel ?? ''}::${logLabel}`;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      onPress={() => {
        if (!disablePressDebounce && pressDebounceMs > 0) {
          const now = Date.now();
          const actionKey = actionKeyRef.current;
          const lastAcceptedPressAt =
            lastAcceptedPressByActionKey.get(actionKey);

          if (
            lastAcceptedPressAt != null &&
            now - lastAcceptedPressAt < pressDebounceMs
          ) {
            return;
          }

          lastAcceptedPressByActionKey.set(actionKey, now);
        }

        if (!disableLogging) {
          log.debug('Pressable pressed', {
            accessibilityLabel: accessibilityLabel ?? null,
            label: logLabel,
            ...logContext,
          });
        }
        onPress?.();
      }}
      style={style}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
