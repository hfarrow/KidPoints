import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LoggedPressable } from '../../components/LoggedPressable';
import { ScreenBackFooter } from '../../components/ScreenBackFooter';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { StatusBadge } from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { useAppLogBuffer } from '../../logging/logBufferStore';
import {
  type AppLogLevel,
  isAppLogLevelAtLeast,
  SUPPORTED_APP_LOG_LEVELS,
} from '../../logging/logger';
import { presentListPickerModal } from '../overlays/listPickerModalStore';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';

const ALL_LOG_LEVELS_OPTION = 'all';

type LogLevelFilterValue = AppLogLevel | typeof ALL_LOG_LEVELS_OPTION;

const LOG_LEVEL_FILTER_OPTIONS: readonly LogLevelFilterValue[] = [
  ALL_LOG_LEVELS_OPTION,
  ...SUPPORTED_APP_LOG_LEVELS,
];

export function LogsScreen() {
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const entries = useAppLogBuffer((state) => state.entries);
  const [expandedLogIds, setExpandedLogIds] = useState<number[]>([]);
  const [selectedLogLevel, setSelectedLogLevel] = useState<LogLevelFilterValue>(
    ALL_LOG_LEVELS_OPTION,
  );
  const [selectedNamespaceIds, setSelectedNamespaceIds] = useState<string[]>(
    [],
  );

  const availableNamespaces = useMemo(() => {
    return [
      ...new Set(
        entries
          .map((entry) => entry.namespace)
          .filter((namespace): namespace is string => Boolean(namespace)),
      ),
    ].sort((firstNamespace, secondNamespace) =>
      firstNamespace.localeCompare(secondNamespace),
    );
  }, [entries]);
  const activeSelectedNamespaceIds = selectedNamespaceIds.filter((namespace) =>
    availableNamespaces.includes(namespace),
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (
        selectedLogLevel !== ALL_LOG_LEVELS_OPTION &&
        !isAppLogLevelAtLeast(entry.level, selectedLogLevel)
      ) {
        return false;
      }

      if (
        activeSelectedNamespaceIds.length > 0 &&
        (!entry.namespace ||
          !activeSelectedNamespaceIds.includes(entry.namespace))
      ) {
        return false;
      }

      return true;
    });
  }, [activeSelectedNamespaceIds, entries, selectedLogLevel]);

  const openNamespacePicker = () => {
    presentListPickerModal({
      closeLabel: 'Close',
      items: availableNamespaces.map((namespace) => ({
        id: namespace,
        label: namespace,
      })),
      onSelect: (itemId) => {
        setSelectedNamespaceIds((currentIds) =>
          currentIds.includes(itemId)
            ? currentIds.filter((currentId) => currentId !== itemId)
            : [...currentIds, itemId],
        );
      },
      selectedItemIds: activeSelectedNamespaceIds,
      selectionMode: 'multiple',
      title: 'Filter Namespaces',
    });
  };

  return (
    <ScreenScaffold footer={<ScreenBackFooter disableLogging />}>
      <ScreenHeader title="Logs" />

      <Tile density="extraCompact" title="Filters">
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            {LOG_LEVEL_FILTER_OPTIONS.map((option) => {
              const isSelected = selectedLogLevel === option;

              return (
                <LoggedPressable
                  accessibilityLabel={`Filter logs at ${option} and above`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  disableLogging
                  key={option}
                  logContext={{
                    logLevel: option,
                    selected: isSelected,
                  }}
                  logLabel={`Set log level filter to ${option}`}
                  onPress={() => {
                    setSelectedLogLevel(option);
                  }}
                  style={[
                    styles.filterToggle,
                    isSelected && styles.filterToggleSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterToggleText,
                      isSelected && styles.filterToggleTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </LoggedPressable>
              );
            })}
          </View>

          <LoggedPressable
            accessibilityLabel="Choose namespace filter"
            accessibilityRole="button"
            disableLogging
            logContext={{
              namespaceCount: activeSelectedNamespaceIds.length,
            }}
            logLabel="Choose namespace filter"
            onPress={openNamespacePicker}
            style={styles.namespacePickerButton}
          >
            <View style={styles.namespaceCopy}>
              <Text style={styles.namespaceLabel}>Namespace</Text>
              <Text style={styles.namespaceValue}>
                {formatNamespaceSummary(activeSelectedNamespaceIds)}
              </Text>
            </View>
            <View style={styles.namespaceAction}>
              {activeSelectedNamespaceIds.length > 0 ? (
                <StatusBadge
                  label={`${activeSelectedNamespaceIds.length} On`}
                  size="mini"
                  tone="good"
                />
              ) : null}
              <View style={styles.namespaceChevron}>
                <Feather
                  color={tokens.controlText}
                  name="chevron-down"
                  size={16}
                />
              </View>
            </View>
          </LoggedPressable>
        </View>
      </Tile>

      {filteredEntries.length === 0 ? (
        <Tile
          density="extraCompact"
          title={entries.length === 0 ? 'No Logs Yet' : 'No Matching Logs'}
        >
          <Text style={styles.emptyCopy}>
            {entries.length === 0
              ? 'Logs written through the shared app logger will appear here during this app session.'
              : 'Try a broader log level or namespace filter to see more entries.'}
          </Text>
        </Tile>
      ) : (
        <View style={styles.logList}>
          {filteredEntries.map((entry, index) => {
            const isExpanded = expandedLogIds.includes(entry.id);

            return (
              <Tile
                accessory={
                  <View style={styles.badgeRow}>
                    <StatusBadge label={entry.level} size="mini" />
                    {entry.namespace ? (
                      <StatusBadge
                        label={entry.namespace}
                        size="mini"
                        tone="good"
                      />
                    ) : null}
                  </View>
                }
                collapsed={!isExpanded}
                collapsible
                collapsibleLabel={entry.previewText}
                density="extraCompact"
                disableCollapseLogging
                key={entry.id}
                onCollapsedChange={(isCollapsed) => {
                  setExpandedLogIds((currentIds) =>
                    isCollapsed
                      ? currentIds.filter((currentId) => currentId !== entry.id)
                      : [...currentIds, entry.id],
                  );
                }}
                title={
                  <View style={styles.titleBlock}>
                    <Text
                      numberOfLines={2}
                      style={styles.logTitle}
                      testID={`log-summary-${index}`}
                    >
                      {entry.previewText}
                    </Text>
                    <Text style={styles.timestampText}>
                      {buildLogTimestampLabel(entry.timestampMs)}
                    </Text>
                  </View>
                }
              >
                <Text selectable style={styles.fullText}>
                  {entry.fullText}
                </Text>
              </Tile>
            );
          })}
        </View>
      )}
    </ScreenScaffold>
  );
}

function formatNamespaceSummary(selectedNamespaceIds: string[]) {
  if (selectedNamespaceIds.length === 0) {
    return 'All Namespaces';
  }

  if (selectedNamespaceIds.length === 1) {
    return selectedNamespaceIds[0];
  }

  return `${selectedNamespaceIds.length} Namespaces`;
}

function buildLogTimestampLabel(timestampMs: number) {
  return new Date(timestampMs).toLocaleString();
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'flex-end',
    },
    emptyCopy: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterSection: {
      gap: 8,
    },
    filterToggle: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 32,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    filterToggleSelected: {
      backgroundColor: tokens.accentSoft,
      borderColor: tokens.accent,
    },
    filterToggleText: {
      color: tokens.controlText,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    filterToggleTextSelected: {
      color: tokens.textPrimary,
    },
    fullText: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    logList: {
      gap: 4,
    },
    logTitle: {
      color: tokens.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
    },
    namespaceAction: {
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 0,
      gap: 6,
    },
    namespaceChevron: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 10,
      height: 20,
      justifyContent: 'center',
      width: 20,
    },
    namespaceCopy: {
      flex: 1,
      gap: 1,
      minWidth: 0,
    },
    namespaceLabel: {
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    namespacePickerButton: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    namespaceValue: {
      color: tokens.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    timestampText: {
      color: tokens.textMuted,
      fontSize: 11,
      lineHeight: 14,
    },
    titleBlock: {
      gap: 1,
    },
  });
