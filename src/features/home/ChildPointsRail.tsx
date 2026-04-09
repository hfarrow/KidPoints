import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { LoggedPressable } from '../../components/LoggedPressable';
import type { SharedCommandResult } from '../../state/sharedTypes';
import { type useAppTheme, useThemedStyles } from '../theme/themeContext';

const POINT_TRANSITION_DURATION_MS = 170;
const MIN_TRAVEL_DISTANCE_PX = 32;
const POINT_VALUE_LINE_HEIGHT = 28;

type ChildPointsRailProps = {
  childId: string;
  childName: string;
  isParentUnlocked: boolean;
  onAdjustPoints: (delta: number) => SharedCommandResult;
  onEditPoints: () => void;
  points: number;
};

type ActivePointTransition = {
  delta: -1 | 1;
  from: number;
  key: number;
  to: number;
};

export function ChildPointsRail({
  childId,
  childName,
  isParentUnlocked,
  onAdjustPoints,
  onEditPoints,
  points,
}: ChildPointsRailProps) {
  const styles = useThemedStyles(createStyles);
  const [settledPoints, setSettledPoints] = useState(points);
  const [pendingSteps, setPendingSteps] = useState<(-1 | 1)[]>([]);
  const [activeTransition, setActiveTransition] =
    useState<ActivePointTransition | null>(null);
  const activeTransitionRef = useRef<ActivePointTransition | null>(null);
  const previousPointsRef = useRef(points);
  const transitionKeyRef = useRef(0);
  const progress = useSharedValue(0);
  const coreWidth = useSharedValue(0);
  const pendingOffset = useMemo(
    () => pendingSteps.reduce((total, step) => total + step, 0),
    [pendingSteps],
  );
  const layoutValue = activeTransition ? activeTransition.to : settledPoints;

  useEffect(() => {
    activeTransitionRef.current = activeTransition;
  }, [activeTransition]);

  useEffect(() => {
    if (previousPointsRef.current === points) {
      return;
    }

    previousPointsRef.current = points;
    const expectedPoints = settledPoints + pendingOffset;

    if (points === expectedPoints) {
      return;
    }

    setPendingSteps([]);
    setActiveTransition(null);
    setSettledPoints(points);
    progress.value = 0;
  }, [pendingOffset, points, progress, settledPoints]);

  useEffect(() => {
    if (activeTransition || pendingSteps.length === 0) {
      return;
    }

    const delta = pendingSteps[0];

    setActiveTransition({
      delta,
      from: settledPoints,
      key: transitionKeyRef.current + 1,
      to: settledPoints + delta,
    });
    transitionKeyRef.current += 1;
  }, [activeTransition, pendingSteps, settledPoints]);

  const completeTransition = useCallback((key: number) => {
    const completedTransition = activeTransitionRef.current;

    if (!completedTransition || completedTransition.key !== key) {
      return;
    }

    activeTransitionRef.current = null;
    setActiveTransition(null);
    setSettledPoints(completedTransition.to);
    setPendingSteps((currentSteps) => currentSteps.slice(1));
  }, []);

  useEffect(() => {
    if (!activeTransition) {
      return;
    }

    progress.value = 0;
    progress.value = withTiming(
      1,
      {
        duration: POINT_TRANSITION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(completeTransition)(activeTransition.key);
        }
      },
    );
  }, [activeTransition, completeTransition, progress]);

  const outgoingValueStyle = useAnimatedStyle(() => {
    if (!activeTransition) {
      return {
        opacity: 1,
        transform: [{ translateX: 0 }],
      };
    }

    const distance = Math.max(coreWidth.value / 2, MIN_TRAVEL_DISTANCE_PX);

    return {
      opacity: 1 - progress.value,
      transform: [
        {
          translateX: progress.value * distance * -activeTransition.delta,
        },
      ],
    };
  });

  const incomingValueStyle = useAnimatedStyle(() => {
    if (!activeTransition) {
      return {
        opacity: 0,
        transform: [{ translateX: 0 }],
      };
    }

    const distance = Math.max(coreWidth.value / 2, MIN_TRAVEL_DISTANCE_PX);

    return {
      opacity: progress.value,
      transform: [
        {
          translateX: (1 - progress.value) * distance * activeTransition.delta,
        },
      ],
    };
  });

  const handleAdjustPoints = (delta: -1 | 1) => {
    const result = onAdjustPoints(delta);

    if (result.ok) {
      setPendingSteps((currentSteps) => [...currentSteps, delta]);
    }
  };

  return (
    <View style={styles.pointsSummary}>
      <View
        style={[
          styles.pointsRail,
          !isParentUnlocked && styles.pointsRailLocked,
        ]}
      >
        {isParentUnlocked ? (
          <LoggedPressable
            accessibilityLabel={`Decrease ${childName} points`}
            accessibilityRole="button"
            logContext={{
              childId,
              childName,
              delta: -1,
            }}
            logLabel={`Decrease ${childName} points`}
            onPress={() => {
              handleAdjustPoints(-1);
            }}
            style={[styles.pointsSegment, styles.pointsCapLeft]}
          >
            <Text style={[styles.pointsCapText, styles.pointsCapTextLeft]}>
              -1
            </Text>
          </LoggedPressable>
        ) : null}
        <LoggedPressable
          accessibilityLabel={`Edit ${childName} points`}
          accessibilityRole="button"
          logContext={{
            childId,
            childName,
            points,
          }}
          logLabel={`Edit ${childName} points`}
          onPress={onEditPoints}
          style={[
            styles.pointsCore,
            !isParentUnlocked && styles.pointsCoreLocked,
          ]}
        >
          <View
            onLayout={(event) => {
              coreWidth.value = event.nativeEvent.layout.width;
            }}
            pointerEvents="none"
            style={styles.pointsValueViewport}
          >
            <Text
              accessible={false}
              style={[styles.pointsValue, styles.pointsValueSizer]}
            >
              {layoutValue}
            </Text>
            {activeTransition ? (
              <>
                <Animated.View
                  style={[styles.pointsValueLayer, outgoingValueStyle]}
                >
                  <Text style={styles.pointsValue}>
                    {activeTransition.from}
                  </Text>
                </Animated.View>
                <Animated.View
                  style={[styles.pointsValueLayer, incomingValueStyle]}
                >
                  <Text style={styles.pointsValue}>{activeTransition.to}</Text>
                </Animated.View>
              </>
            ) : (
              <View style={styles.pointsValueLayer}>
                <Text style={styles.pointsValue}>{settledPoints}</Text>
              </View>
            )}
          </View>
        </LoggedPressable>
        {isParentUnlocked ? (
          <LoggedPressable
            accessibilityLabel={`Increase ${childName} points`}
            accessibilityRole="button"
            logContext={{
              childId,
              childName,
              delta: 1,
            }}
            logLabel={`Increase ${childName} points`}
            onPress={() => {
              handleAdjustPoints(1);
            }}
            style={[styles.pointsSegment, styles.pointsCapRight]}
          >
            <Text style={[styles.pointsCapText, styles.pointsCapTextRight]}>
              +1
            </Text>
          </LoggedPressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = ({
  resolvedTheme,
  tokens,
}: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    pointsSummary: {
      flex: 1,
      minWidth: 0,
    },
    pointsRail: {
      backgroundColor: tokens.controlSurface,
      borderRadius: 999,
      flexDirection: 'row',
      minHeight: 42,
      overflow: 'hidden',
    },
    pointsRailLocked: {
      alignSelf: 'flex-start',
    },
    pointsSegment: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    pointsCapLeft: {
      backgroundColor: resolvedTheme === 'dark' ? '#562646' : '#ffd7eb',
      borderRightColor: resolvedTheme === 'dark' ? '#7c3a63' : '#f4b6d6',
      borderRightWidth: 1,
      flexBasis: 0,
      flexGrow: 2,
    },
    pointsCapRight: {
      backgroundColor: resolvedTheme === 'dark' ? '#1f3560' : '#dbe8ff',
      borderLeftColor: resolvedTheme === 'dark' ? '#33528d' : '#bccffb',
      borderLeftWidth: 1,
      flexBasis: 0,
      flexGrow: 2,
    },
    pointsCore: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      flexBasis: 0,
      flexGrow: 6,
      justifyContent: 'center',
      minWidth: 0,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    pointsCoreLocked: {
      borderRadius: 999,
      flexBasis: 'auto',
      flexGrow: 0,
      minWidth: 110,
    },
    pointsCapText: {
      fontSize: 14,
      fontWeight: '800',
    },
    pointsCapTextLeft: {
      color: resolvedTheme === 'dark' ? '#ffe5f1' : '#8a1d55',
    },
    pointsCapTextRight: {
      color: resolvedTheme === 'dark' ? '#e2ecff' : '#23458f',
    },
    pointsValueViewport: {
      alignItems: 'center',
      height: POINT_VALUE_LINE_HEIGHT,
      justifyContent: 'center',
      overflow: 'hidden',
      width: '100%',
    },
    pointsValueLayer: {
      alignItems: 'center',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    pointsValue: {
      color: tokens.textPrimary,
      fontSize: 24,
      fontVariant: ['tabular-nums'],
      fontWeight: '900',
      lineHeight: POINT_VALUE_LINE_HEIGHT,
    },
    pointsValueSizer: {
      opacity: 0,
    },
  });
