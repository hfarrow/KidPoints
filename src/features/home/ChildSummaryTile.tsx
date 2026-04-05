import { Feather, Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Tile } from '../../components/Tile';
import { useAppTheme } from '../theme/themeContext';

const CHILD_ACTION_ICON_COLOR = '#0f172a';

type ChildSummaryTileProps = {
  childDisplayName: string;
  childId: string;
  isParentUnlocked: boolean;
  onDecrementPoints: (childId: string) => void;
  onEditPoints: (childId: string) => void;
  onIncrementPoints: (childId: string) => void;
  onOpenSettings: (childId: string, displayName: string) => void;
  points: number;
};

export function ChildSummaryTile({
  childDisplayName,
  childId,
  isParentUnlocked,
  onDecrementPoints,
  onEditPoints,
  onIncrementPoints,
  onOpenSettings,
  points,
}: ChildSummaryTileProps) {
  const { tokens } = useAppTheme();

  return (
    <Tile
      collapsible={false}
      floatingTitle
      headerAccessory={
        isParentUnlocked ? (
          <Pressable
            accessibilityLabel={`Open ${childDisplayName} settings`}
            onPress={() => onOpenSettings(childId, childDisplayName)}
            style={[
              styles.iconAction,
              { backgroundColor: tokens.controlSurface },
            ]}
          >
            <Ionicons
              color={tokens.controlText}
              name="settings-outline"
              size={18}
            />
          </Pressable>
        ) : null
      }
      summaryVisibleWhenExpanded
      title={childDisplayName}
      collapsedSummary={
        <View style={styles.collapsedChildSummary}>
          <View
            style={[
              styles.childControlsRail,
              { backgroundColor: tokens.controlSurface },
            ]}
          >
            {isParentUnlocked ? (
              <Pressable
                accessibilityLabel={`Decrease ${childDisplayName} points`}
                onPress={() => onDecrementPoints(childId)}
                style={[
                  styles.childSegment,
                  styles.childActionSegment,
                  styles.childActionSegmentLeft,
                ]}
              >
                <Feather
                  color={CHILD_ACTION_ICON_COLOR}
                  name="minus"
                  size={20}
                />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel={`Edit ${childDisplayName} points`}
              onPress={() => onEditPoints(childId)}
              style={[
                styles.childSegment,
                styles.childPointsSegment,
                { backgroundColor: tokens.inputSurface },
              ]}
            >
              <Text
                style={[styles.childPointsValue, { color: tokens.textPrimary }]}
              >
                {points}
              </Text>
            </Pressable>
            {isParentUnlocked ? (
              <Pressable
                accessibilityLabel={`Increase ${childDisplayName} points`}
                onPress={() => onIncrementPoints(childId)}
                style={[
                  styles.childSegment,
                  styles.childActionSegment,
                  styles.childActionSegmentRight,
                ]}
              >
                <Feather
                  color={CHILD_ACTION_ICON_COLOR}
                  name="plus"
                  size={20}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  iconAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedChildSummary: {
    flex: 1,
    minWidth: 0,
  },
  childControlsRail: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: 23,
  },
  childSegment: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 10,
  },
  childActionSegment: {
    flexBasis: 0,
    flexGrow: 2,
    backgroundColor: '#d1dbe8',
    paddingHorizontal: 8,
  },
  childActionSegmentLeft: {
    backgroundColor: '#fee2e2',
    borderRightWidth: 1,
    borderRightColor: '#fbcfe8',
  },
  childActionSegmentRight: {
    backgroundColor: '#dcfce7',
    borderLeftWidth: 1,
    borderLeftColor: '#bbf7d0',
  },
  childPointsSegment: {
    flexBasis: 0,
    flexGrow: 6,
    paddingHorizontal: 14,
  },
  childPointsValue: {
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
