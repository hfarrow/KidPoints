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
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import type { SharedCommandResult } from '../../state/sharedTypes';
import { triggerLightImpactHaptic } from '../haptics/appHaptics';
import {
  CHILD_POINTS_CAP_MIN_WIDTH,
  CHILD_POINTS_RAIL_MIN_HEIGHT,
} from '../points/pointsRailMetrics';
import { type useAppTheme, useThemedStyles } from '../theme/appTheme';

const POINT_TRANSITION_DURATION_MS = 250;
const MIN_TRAVEL_DISTANCE_PX = 32;
const POINT_VALUE_LINE_HEIGHT = 52;

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
  const hapticsEnabled = useLocalSettingsStore((state) => state.hapticsEnabled);
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
      triggerLightImpactHaptic(hapticsEnabled);
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
            disablePressDebounce
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
          onLayout={(event) => {
            coreWidth.value = event.nativeEvent.layout.width;
          }}
        >
          <View pointerEvents="none" style={styles.pointsValueViewport}>
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
          </View>
        </LoggedPressable>
        {isParentUnlocked ? (
          <LoggedPressable
            accessibilityLabel={`Increase ${childName} points`}
            accessibilityRole="button"
            disablePressDebounce
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
        <View pointerEvents="none" style={styles.pointsAnimationLayer}>
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
      </View>
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    pointsSummary: {
      flex: 1,
      minWidth: 0,
    },
    pointsRail: {
      backgroundColor: tokens.controlSurface,
      borderRadius: 999,
      flexDirection: 'row',
      minHeight: CHILD_POINTS_RAIL_MIN_HEIGHT,
      overflow: 'hidden',
    },
    pointsRailLocked: {
      alignSelf: 'flex-start',
    },
    pointsSegment: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: CHILD_POINTS_CAP_MIN_WIDTH,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    pointsCapLeft: {
      backgroundColor: tokens.actionDecrementSurface,
      borderRightColor: tokens.actionDecrementBorder,
      borderRightWidth: 1,
      flexBasis: 0,
      flexGrow: 2,
    },
    pointsCapRight: {
      backgroundColor: tokens.actionIncrementSurface,
      borderLeftColor: tokens.actionIncrementBorder,
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
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    pointsCoreLocked: {
      borderRadius: 999,
      flexBasis: 'auto',
      flexGrow: 0,
      minHeight: CHILD_POINTS_RAIL_MIN_HEIGHT,
      minWidth: 150,
    },
    pointsCapText: {
      fontSize: 18,
      fontWeight: '800',
    },
    pointsCapTextLeft: {
      color: tokens.actionDecrementText,
    },
    pointsCapTextRight: {
      color: tokens.actionIncrementText,
    },
    pointsValueViewport: {
      alignItems: 'center',
      height: POINT_VALUE_LINE_HEIGHT,
      justifyContent: 'center',
      width: '100%',
    },
    pointsAnimationLayer: {
      alignItems: 'center',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
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
      fontSize: 38,
      fontVariant: ['tabular-nums'],
      fontWeight: '900',
      lineHeight: POINT_VALUE_LINE_HEIGHT,
    },
    pointsValueSizer: {
      opacity: 0,
    },
  });
