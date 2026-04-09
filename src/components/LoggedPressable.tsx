import type { ReactNode } from 'react';
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
  disableLogging?: boolean;
  logContext?: Record<string, unknown>;
  logLabel: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const log = createModuleLogger('pressable');

export function LoggedPressable({
  accessibilityLabel,
  accessibilityRole = 'button',
  children,
  disableLogging = false,
  logContext,
  logLabel,
  onPress,
  style,
  ...rest
}: LoggedPressableProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      onPress={() => {
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
