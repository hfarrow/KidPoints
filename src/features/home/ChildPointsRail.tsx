import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { LoggedPressable } from '../../components/LoggedPressable';
import type { SharedCommandResult } from '../../state/sharedTypes';
import { type useAppTheme, useThemedStyles } from '../theme/themeContext';

const POINT_TRANSITION_DURATION_MS = 200;
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

type PointRunnerSnapshot = {
  delta: -1 | 1;
  id: number;
  kind: 'incoming' | 'outgoing';
  value: number;
};

type PointRunnerProps = {
  coreWidth: SharedValue<number>;
  delta: -1 | 1;
  kind: 'incoming' | 'outgoing';
  onComplete: (id: number) => void;
  runnerId: number;
  textStyle: TextStyle;
  value: number;
  wrapperStyle: ViewStyle;
};

function PointRunner({
  coreWidth,
  delta,
  kind,
  onComplete,
  runnerId,
  textStyle,
  value,
  wrapperStyle,
}: PointRunnerProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(
      1,
      {
        duration: POINT_TRANSITION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(onComplete)(runnerId);
        }
      },
    );
  }, [onComplete, progress, runnerId]);

  const runnerStyle = useAnimatedStyle(() => {
    const distance = Math.max(coreWidth.value / 2, MIN_TRAVEL_DISTANCE_PX);
    const opacity =
      kind === 'incoming'
        ? Easing.out(Easing.cubic)(progress.value)
        : 1 - Easing.in(Easing.cubic)(progress.value);
    const translateX =
      kind === 'incoming'
        ? (1 - progress.value) * distance * delta
        : progress.value * distance * -delta;

    return {
      opacity,
      transform: [
        {
          translateX,
        },
      ],
    };
  });

  return (
    <Animated.View style={[wrapperStyle, runnerStyle]}>
      <Text style={textStyle}>{value}</Text>
    </Animated.View>
  );
}

export function ChildPointsRail({
  childId,
  childName,
  isParentUnlocked,
  onAdjustPoints,
  onEditPoints,
  points,
}: ChildPointsRailProps) {
  const styles = useThemedStyles(createStyles);
  const [centeredPoints, setCenteredPoints] = useState<number | null>(points);
  const [runners, setRunners] = useState<PointRunnerSnapshot[]>([]);
  const expectedPointsRef = useRef(points);
  const previousPointsRef = useRef(points);
  const runnerIdRef = useRef(0);
  const runnersRef = useRef<PointRunnerSnapshot[]>([]);
  const coreWidth = useSharedValue(0);
  const layoutValue =
    runners.length > 0 ? expectedPointsRef.current : (centeredPoints ?? points);

  useEffect(() => {
    runnersRef.current = runners;
  }, [runners]);

  useEffect(() => {
    if (previousPointsRef.current === points) {
      return;
    }

    previousPointsRef.current = points;

    if (points !== expectedPointsRef.current) {
      expectedPointsRef.current = points;
      setRunners([]);
      setCenteredPoints(points);
    }
  }, [points]);

  const handleRunnerComplete = useCallback((runnerId: number) => {
    const completedRunner =
      runnersRef.current.find((runner) => runner.id === runnerId) ?? null;

    setRunners((currentRunners) =>
      currentRunners.filter((runner) => runner.id !== runnerId),
    );

    if (!completedRunner || completedRunner.kind === 'outgoing') {
      return;
    }

    if (completedRunner.value === expectedPointsRef.current) {
      setCenteredPoints(completedRunner.value);
      return;
    }

    const outgoingRunnerId = runnerIdRef.current + 1;
    runnerIdRef.current = outgoingRunnerId;
    setRunners((currentRunners) => [
      ...currentRunners,
      {
        delta: completedRunner.delta,
        id: outgoingRunnerId,
        kind: 'outgoing',
        value: completedRunner.value,
      },
    ]);
  }, []);

  const handleAdjustPoints = (delta: -1 | 1) => {
    const result = onAdjustPoints(delta);

    if (result.ok) {
      const currentPoints = expectedPointsRef.current;
      const nextPoints = currentPoints + delta;

      if (centeredPoints === currentPoints) {
        const outgoingRunnerId = runnerIdRef.current + 1;
        runnerIdRef.current = outgoingRunnerId;
        setCenteredPoints(null);
        setRunners((currentRunners) => [
          ...currentRunners,
          {
            delta,
            id: outgoingRunnerId,
            kind: 'outgoing',
            value: currentPoints,
          },
        ]);
      }

      expectedPointsRef.current = nextPoints;
      const incomingRunnerId = runnerIdRef.current + 1;
      runnerIdRef.current = incomingRunnerId;
      setRunners((currentRunners) => [
        ...currentRunners,
        {
          delta,
          id: incomingRunnerId,
          kind: 'incoming',
          value: nextPoints,
        },
      ]);
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
            {centeredPoints != null ? (
              <View style={styles.pointsValueLayer}>
                <Text style={styles.pointsValue}>{centeredPoints}</Text>
              </View>
            ) : null}
            {runners.map((runner) => (
              <PointRunner
                coreWidth={coreWidth}
                delta={runner.delta}
                key={runner.id}
                kind={runner.kind}
                onComplete={handleRunnerComplete}
                runnerId={runner.id}
                textStyle={styles.pointsValue}
                value={runner.value}
                wrapperStyle={styles.pointsValueLayer}
              />
            ))}
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
