import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { LoggedPressable } from '../../components/LoggedPressable';
import { MultiSelectList } from '../../components/MultiSelectList';
import { ScreenBackFooter } from '../../components/ScreenBackFooter';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  ActionPillRow,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { useAppLogBuffer } from '../../logging/logBufferStore';
import {
  type AppLogLevel,
  isAppLogLevelAtLeast,
  SUPPORTED_APP_LOG_LEVELS,
} from '../../logging/logger';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import { buildLogNamespaceColorAssignment } from './namespaceColors';
import { shareBufferedLogsAsync } from './shareLogs';

const ALL_VISIBLE_LOG_LEVEL: AppLogLevel = 'temp';

export function LogsScreen() {
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const entries = useAppLogBuffer((state) => state.entries);
  const ensureLogNamespaceColors = useLocalSettingsStore(
    (state) => state.ensureLogNamespaceColors,
  );
  const logNamespaceColors = useLocalSettingsStore(
    (state) => state.logNamespaceColors,
  );
  const resetLogNamespaceColors = useLocalSettingsStore(
    (state) => state.resetLogNamespaceColors,
  );
  const [expandedLogIds, setExpandedLogIds] = useState<number[]>([]);
  const [selectedLogLevel, setSelectedLogLevel] = useState<AppLogLevel>(
    ALL_VISIBLE_LOG_LEVEL,
  );
  const [selectedNamespaceIds, setSelectedNamespaceIds] = useState<string[]>(
    [],
  );
  const [isNamespaceFilterVisible, setIsNamespaceFilterVisible] =
    useState(false);
  const [isSharingLogs, setIsSharingLogs] = useState(false);

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
  const bufferedNamespacesByReservationOrder = useMemo(() => {
    return [
      ...new Set(
        [...entries]
          .reverse()
          .map((entry) => entry.namespace)
          .filter((namespace): namespace is string => Boolean(namespace)),
      ),
    ];
  }, [entries]);
  const activeSelectedNamespaceIds = selectedNamespaceIds.filter((namespace) =>
    availableNamespaces.includes(namespace),
  );
  const areAllLogsVisible =
    selectedLogLevel === ALL_VISIBLE_LOG_LEVEL &&
    activeSelectedNamespaceIds.length === 0;
  const namespaceBadgeAssignments = useMemo(() => {
    return Object.fromEntries(
      Object.entries(logNamespaceColors).map(([namespace, backgroundColor]) => [
        namespace,
        buildLogNamespaceColorAssignment(backgroundColor),
      ]),
    );
  }, [logNamespaceColors]);

  useEffect(() => {
    if (bufferedNamespacesByReservationOrder.length === 0) {
      return;
    }

    ensureLogNamespaceColors(bufferedNamespacesByReservationOrder);
  }, [bufferedNamespacesByReservationOrder, ensureLogNamespaceColors]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!isAppLogLevelAtLeast(entry.level, selectedLogLevel)) {
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

  const toggleNamespaceFilter = (itemId: string) => {
    setSelectedNamespaceIds((currentIds) =>
      currentIds.includes(itemId)
        ? currentIds.filter((currentId) => currentId !== itemId)
        : [...currentIds, itemId],
    );
  };

  const handleShareLogs = async ({
    emptyMessage,
    emptyTitle,
    entriesToShare,
    namespaceIds,
    selectedLevel,
  }: {
    emptyMessage: string;
    emptyTitle: string;
    entriesToShare: typeof entries;
    namespaceIds: string[];
    selectedLevel: AppLogLevel | 'all';
  }) => {
    if (isSharingLogs) {
      return;
    }

    if (entriesToShare.length === 0) {
      Alert.alert(emptyTitle, emptyMessage);
      return;
    }

    setIsSharingLogs(true);

    try {
      const result = await shareBufferedLogsAsync({
        entries: entriesToShare,
        selectedLogLevel: selectedLevel,
        selectedNamespaceIds: namespaceIds,
      });

      if (!result.ok && result.reason === 'sharing-unavailable') {
        Alert.alert(
          'Sharing Unavailable',
          'This device does not currently support sharing exported log files.',
        );
      }
    } catch {
      Alert.alert(
        'Unable To Share Logs',
        'The log export could not be prepared right now.',
      );
    } finally {
      setIsSharingLogs(false);
    }
  };

  return (
    <View style={styles.screenRoot}>
      <ScreenScaffold footer={<ScreenBackFooter disableLogging />}>
        <ScreenHeader title="Logs" />

        <Tile density="extraCompact" title="Filters">
          <View style={styles.filterSection}>
            <View style={styles.filterRow}>
              {SUPPORTED_APP_LOG_LEVELS.map((option) => {
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
              onPress={() => {
                setIsNamespaceFilterVisible(true);
              }}
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

            <ActionPillRow>
              <ActionPill
                disableLogging
                label={isSharingLogs ? 'Sharing...' : 'Share All Logs'}
                onPress={() => {
                  void handleShareLogs({
                    emptyMessage: 'There are no logs to share right now.',
                    emptyTitle: 'No Logs To Share',
                    entriesToShare: entries,
                    namespaceIds: [],
                    selectedLevel: 'all',
                  });
                }}
                tone="primary"
              />
              {!areAllLogsVisible ? (
                <ActionPill
                  disableLogging
                  label={isSharingLogs ? 'Sharing...' : 'Share Visible Logs'}
                  onPress={() => {
                    void handleShareLogs({
                      emptyMessage:
                        'There are no visible logs to share right now.',
                      emptyTitle: 'No Logs To Share',
                      entriesToShare: filteredEntries,
                      namespaceIds: activeSelectedNamespaceIds,
                      selectedLevel: selectedLogLevel,
                    });
                  }}
                  tone="primary"
                />
              ) : null}
              <ActionPill
                disableLogging
                label="Reset Namespace Colors"
                onPress={() => {
                  resetLogNamespaceColors();
                  ensureLogNamespaceColors(
                    bufferedNamespacesByReservationOrder,
                  );
                }}
              />
            </ActionPillRow>
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
              const namespaceBadgeAssignment = entry.namespace
                ? namespaceBadgeAssignments[entry.namespace]
                : null;

              return (
                <Tile
                  accessory={
                    <View style={styles.badgeRow}>
                      <StatusBadge label={entry.level} size="mini" />
                      {entry.namespace ? (
                        <StatusBadge
                          badgeStyle={
                            namespaceBadgeAssignment
                              ? {
                                  backgroundColor:
                                    namespaceBadgeAssignment.backgroundColor,
                                }
                              : undefined
                          }
                          label={entry.namespace}
                          labelStyle={
                            namespaceBadgeAssignment
                              ? {
                                  color: namespaceBadgeAssignment.textColor,
                                }
                              : undefined
                          }
                          size="mini"
                          testID={`log-namespace-badge-${entry.id}`}
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
                        ? currentIds.filter(
                            (currentId) => currentId !== entry.id,
                          )
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
      <MultiSelectList
        closeLabel="Close"
        disableLogging
        emptyState={
          <Text style={styles.emptyCopy}>
            Namespace filters will appear here after logs with namespaces have
            been buffered in this app session.
          </Text>
        }
        getItemLabel={(item) => item.label}
        items={availableNamespaces.map((namespace) => ({
          id: namespace,
          label: namespace,
        }))}
        keyExtractor={(item) => item.id}
        onRequestClose={() => {
          setIsNamespaceFilterVisible(false);
        }}
        onToggle={(item) => {
          toggleNamespaceFilter(item.id);
        }}
        selectedItemIds={activeSelectedNamespaceIds}
        subtitle="Choose which logger namespaces stay visible in the log viewer."
        title="Filter Namespaces"
        visible={isNamespaceFilterVisible}
      />
    </View>
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
    screenRoot: {
      flex: 1,
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
