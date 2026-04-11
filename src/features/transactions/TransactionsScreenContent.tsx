import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LoggedPressable } from '../../components/LoggedPressable';
import {
  ActionPill,
  CompactSurface,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { createModuleLogger } from '../../logging/logger';
import { deriveTransactionRows, useSharedStore } from '../../state/sharedStore';
import type { SharedDocument, TransactionRow } from '../../state/sharedTypes';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';

const log = createModuleLogger('transactions-screen');

type TransactionDisplayItem =
  | {
      id: string;
      kind: 'group';
      rows: TransactionRow[];
      summaryText: string;
      timestampLabel: string;
    }
  | {
      id: string;
      kind: 'single';
      row: TransactionRow;
      summaryText: string;
      timestampLabel: string;
    };

function buildRestoreStatusCopy(row: TransactionRow) {
  return (
    row.restoreDisabledReason ?? 'This transaction can no longer be restored.'
  );
}

function isPointAction(row: TransactionRow) {
  return row.kind === 'points-adjusted' || row.kind === 'points-set';
}

function summarizeGroupedPointRows(rows: TransactionRow[]) {
  const newestRow = rows[0];
  const oldestRow = rows.at(-1);
  const childName = newestRow.childName ?? oldestRow?.childName ?? 'Child';

  if (
    oldestRow?.pointsBefore != null &&
    newestRow.pointsAfter != null &&
    rows.every((row) => row.kind === 'points-adjusted')
  ) {
    const delta = newestRow.pointsAfter - oldestRow.pointsBefore;
    const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;

    return `${childName} ${deltaLabel} Points [${oldestRow.pointsBefore} > ${newestRow.pointsAfter}]`;
  }

  if (oldestRow?.pointsBefore != null && newestRow.pointsAfter != null) {
    return `${childName} Point Changes [${oldestRow.pointsBefore} > ${newestRow.pointsAfter}]`;
  }

  return `${childName} Point Changes`;
}

function buildDisplayItems(rows: TransactionRow[]) {
  const items: TransactionDisplayItem[] = [];
  let index = 0;

  while (index < rows.length) {
    const row = rows[index];

    if (row.groupId && row.groupLabel) {
      const groupedRows = [row];
      let nextIndex = index + 1;

      while (nextIndex < rows.length) {
        const nextRow = rows[nextIndex];

        if (nextRow.groupId !== row.groupId) {
          break;
        }

        groupedRows.push(nextRow);
        nextIndex += 1;
      }

      items.push({
        id: `group-${row.groupId}`,
        kind: 'group',
        rows: groupedRows,
        summaryText: row.groupLabel,
        timestampLabel: groupedRows[0].timestampLabel,
      });
      index = nextIndex;
      continue;
    }

    if (isPointAction(row) && row.childId) {
      const groupedRows = [row];
      let nextIndex = index + 1;

      while (nextIndex < rows.length) {
        const nextRow = rows[nextIndex];

        if (!isPointAction(nextRow) || nextRow.childId !== row.childId) {
          break;
        }

        groupedRows.push(nextRow);
        nextIndex += 1;
      }

      if (groupedRows.length > 1) {
        items.push({
          id: `group-${groupedRows[0].id}`,
          kind: 'group',
          rows: groupedRows,
          summaryText: summarizeGroupedPointRows(groupedRows),
          timestampLabel: groupedRows[0].timestampLabel,
        });
        index = nextIndex;
        continue;
      }
    }

    items.push({
      id: row.id,
      kind: 'single',
      row,
      summaryText: row.summaryText,
      timestampLabel: row.timestampLabel,
    });
    index += 1;
  }

  return items;
}

function itemContainsTransaction(
  item: TransactionDisplayItem,
  transactionId: string | null,
) {
  if (!transactionId) {
    return false;
  }

  return item.kind === 'group'
    ? item.rows.some((row) => row.id === transactionId)
    : item.row.id === transactionId;
}

function findDisplayItemByTransactionId(
  items: TransactionDisplayItem[],
  transactionId: string | null,
) {
  return items.find((item) => itemContainsTransaction(item, transactionId));
}

function renderRowBadges(row: TransactionRow) {
  return (
    <View style={stylesForBadges.badgeRow}>
      {row.isHead ? <StatusBadge label="HEAD" size="mini" tone="good" /> : null}
      {row.isOrphaned ? (
        <StatusBadge label="ORPHANED" size="mini" tone="warning" />
      ) : null}
    </View>
  );
}

const stylesForBadges = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
  },
});

export function TransactionsScreenContent({
  onRequestScroll,
}: {
  onRequestScroll?: (y: number) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const itemLayoutYRef = useRef<Record<string, number>>({});
  const document = useSharedStore((state) => state.document);
  const restoreTransaction = useSharedStore(
    (state) => state.restoreTransaction,
  );
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [showOrphaned, setShowOrphaned] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>([]);
  const [expandedNestedRowIds, setExpandedNestedRowIds] = useState<string[]>(
    [],
  );
  const [highlightedTransactionId, setHighlightedTransactionId] = useState<
    string | null
  >(null);
  const [pendingHeadFocus, setPendingHeadFocus] = useState(false);
  const [pendingJumpTargetId, setPendingJumpTargetId] = useState<string | null>(
    null,
  );
  const rows = useMemo(() => deriveTransactionRows(document), [document]);
  const allDisplayItems = useMemo(() => buildDisplayItems(rows), [rows]);
  const filterChildren = useMemo(
    () => deriveTransactionFilterChildren(document),
    [document],
  );

  useEffect(() => {
    log.debug('Transactions screen initialized');
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!showOrphaned && row.isOrphaned) {
        return false;
      }

      if (selectedChildIds.length === 0) {
        return true;
      }

      return row.affectedChildIds.some((childId) =>
        selectedChildIds.includes(childId),
      );
    });
  }, [rows, selectedChildIds, showOrphaned]);
  const displayItems = useMemo(
    () => buildDisplayItems(filteredRows),
    [filteredRows],
  );

  useEffect(() => {
    if (!pendingJumpTargetId) {
      return;
    }

    const targetItem = findDisplayItemByTransactionId(
      displayItems,
      pendingJumpTargetId,
    );

    if (!targetItem) {
      return;
    }

    setExpandedItemIds((currentIds) =>
      currentIds.includes(targetItem.id)
        ? currentIds
        : [...currentIds, targetItem.id],
    );
    setExpandedNestedRowIds((currentIds) =>
      currentIds.includes(pendingJumpTargetId)
        ? currentIds
        : [...currentIds, pendingJumpTargetId],
    );
    setHighlightedTransactionId(pendingJumpTargetId);

    requestAnimationFrame(() => {
      const targetY = itemLayoutYRef.current[targetItem.id];

      if (targetY != null) {
        onRequestScroll?.(Math.max(targetY - 12, 0));
      }
    });

    setPendingJumpTargetId(null);
  }, [displayItems, onRequestScroll, pendingJumpTargetId]);

  useEffect(() => {
    if (!highlightedTransactionId) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setHighlightedTransactionId((currentId) =>
        currentId === highlightedTransactionId ? null : currentId,
      );
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [highlightedTransactionId]);

  useEffect(() => {
    if (!pendingHeadFocus || !document.currentHeadTransactionId) {
      return;
    }

    const headItem = findDisplayItemByTransactionId(
      displayItems,
      document.currentHeadTransactionId,
    );

    if (!headItem) {
      return;
    }

    setExpandedItemIds((currentIds) =>
      currentIds.includes(headItem.id)
        ? currentIds
        : [...currentIds, headItem.id],
    );
    setHighlightedTransactionId(document.currentHeadTransactionId);

    requestAnimationFrame(() => {
      onRequestScroll?.(0);
    });

    setPendingHeadFocus(false);
  }, [
    displayItems,
    document.currentHeadTransactionId,
    onRequestScroll,
    pendingHeadFocus,
  ]);

  const handleRestoreTransaction = (transactionId: string) => {
    const result = restoreTransaction(transactionId);

    if (result.ok) {
      setPendingHeadFocus(true);
    }
  };

  return (
    <>
      <Tile density="extraCompact" title="Filters">
        <View style={styles.filterRow}>
          {filterChildren.map((child) => {
            const isSelected = selectedChildIds.includes(child.id);

            return (
              <LoggedPressable
                key={child.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                logContext={{
                  childId: child.id,
                  childName: child.name,
                  selected: isSelected,
                }}
                logLabel={`Toggle ${child.name} transaction filter`}
                onPress={() => {
                  setSelectedChildIds((currentIds) =>
                    currentIds.includes(child.id)
                      ? currentIds.filter((currentId) => currentId !== child.id)
                      : [...currentIds, child.id],
                  );
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
                  {child.name}
                </Text>
              </LoggedPressable>
            );
          })}
          <LoggedPressable
            accessibilityRole="button"
            accessibilityState={{ selected: showOrphaned }}
            logContext={{ selected: showOrphaned }}
            logLabel="Toggle orphaned transaction filter"
            onPress={() => {
              setShowOrphaned((currentValue) => !currentValue);
            }}
            style={[
              styles.filterToggle,
              showOrphaned && styles.filterToggleSelected,
            ]}
          >
            <Text
              style={[
                styles.filterToggleText,
                showOrphaned && styles.filterToggleTextSelected,
              ]}
            >
              Orphaned
            </Text>
          </LoggedPressable>
        </View>
      </Tile>

      {displayItems.length === 0 ? (
        <Tile density="extraCompact" title="No Transactions Yet">
          <Text style={styles.emptyCopy}>
            Transactions will appear here as soon as points or child state
            changes are recorded.
          </Text>
        </Tile>
      ) : (
        <View style={styles.transactionList}>
          {displayItems.map((item, index) => {
            if (item.kind === 'group') {
              const hasHead = item.rows.some((row) => row.isHead);
              const hasOrphaned = item.rows.some((row) => row.isOrphaned);

              return (
                <View
                  key={item.id}
                  onLayout={(event) => {
                    itemLayoutYRef.current[item.id] =
                      event.nativeEvent.layout.y;
                  }}
                >
                  <Tile
                    accessory={
                      <View style={styles.badgeRow}>
                        <StatusBadge
                          label={`${item.rows.length} Actions`}
                          size="mini"
                          tone="neutral"
                        />
                        {hasHead ? (
                          <StatusBadge label="HEAD" size="mini" tone="good" />
                        ) : null}
                        {hasOrphaned ? (
                          <StatusBadge
                            label="ORPHANED"
                            size="mini"
                            tone="warning"
                          />
                        ) : null}
                      </View>
                    }
                    collapsed={!expandedItemIds.includes(item.id)}
                    collapsible
                    collapsibleLabel={item.summaryText}
                    density="extraCompact"
                    onCollapsedChange={(isCollapsed) => {
                      setExpandedItemIds((currentIds) =>
                        isCollapsed
                          ? currentIds.filter(
                              (currentId) => currentId !== item.id,
                            )
                          : [...currentIds, item.id],
                      );
                    }}
                    style={
                      itemContainsTransaction(item, highlightedTransactionId)
                        ? styles.highlightedTile
                        : undefined
                    }
                    title={
                      <View style={styles.titleBlock}>
                        <Text
                          numberOfLines={2}
                          style={styles.transactionTitle}
                          testID={`transaction-summary-${index}`}
                        >
                          {item.summaryText}
                        </Text>
                        <Text style={styles.timestampText}>
                          {item.timestampLabel}
                        </Text>
                      </View>
                    }
                  >
                    <View style={styles.subtileList}>
                      {item.rows.map((row) => {
                        const isNestedExpanded = expandedNestedRowIds.includes(
                          row.id,
                        );

                        return (
                          <CompactSurface
                            key={row.id}
                            style={[
                              styles.subtile,
                              row.id === highlightedTransactionId &&
                                styles.highlightedSubtile,
                            ]}
                          >
                            <LoggedPressable
                              accessibilityLabel={`${isNestedExpanded ? 'Collapse' : 'Expand'} ${row.summaryText}`}
                              accessibilityRole="button"
                              logContext={{
                                isExpanded: isNestedExpanded,
                                transactionId: row.id,
                              }}
                              logLabel={`${isNestedExpanded ? 'Collapse' : 'Expand'} ${row.summaryText}`}
                              onPress={() => {
                                setExpandedNestedRowIds((currentIds) =>
                                  currentIds.includes(row.id)
                                    ? currentIds.filter(
                                        (currentId) => currentId !== row.id,
                                      )
                                    : [...currentIds, row.id],
                                );
                              }}
                              style={styles.subtileHeader}
                            >
                              <View style={styles.subtileTitleBlock}>
                                <Text style={styles.subtileTitle}>
                                  {row.summaryText}
                                </Text>
                                <Text style={styles.timestampText}>
                                  {row.timestampLabel}
                                </Text>
                              </View>
                              <View style={styles.subtileHeaderActions}>
                                {renderRowBadges(row)}
                                <View style={styles.subtileExpanderButton}>
                                  <Feather
                                    color={tokens.controlText}
                                    name={
                                      isNestedExpanded
                                        ? 'chevron-down'
                                        : 'chevron-right'
                                    }
                                    size={16}
                                  />
                                </View>
                              </View>
                            </LoggedPressable>
                            {isNestedExpanded ? (
                              <>
                                {row.isOrphaned && !row.isRestorableNow ? (
                                  <Text style={styles.metaCopy}>
                                    This transaction lives on a diverged history
                                    branch. A newer action sealed that branch,
                                    so it can no longer be restored.
                                  </Text>
                                ) : !row.isHead && !row.isRestorableNow ? (
                                  <Text style={styles.metaCopy}>
                                    {buildRestoreStatusCopy(row)}
                                  </Text>
                                ) : null}
                                {row.isRestorableNow &&
                                row.kind !== 'history-restored' ? (
                                  <ActionPill
                                    label="Restore To This Point"
                                    onPress={() => {
                                      handleRestoreTransaction(row.id);
                                    }}
                                    tone="primary"
                                  />
                                ) : null}
                              </>
                            ) : null}
                          </CompactSurface>
                        );
                      })}
                    </View>
                  </Tile>
                </View>
              );
            }

            const row = item.row;

            return (
              <View
                key={item.id}
                onLayout={(event) => {
                  itemLayoutYRef.current[item.id] = event.nativeEvent.layout.y;
                }}
              >
                <Tile
                  accessory={renderRowBadges(row)}
                  collapsed={!expandedItemIds.includes(item.id)}
                  collapsible
                  collapsibleLabel={item.summaryText}
                  density="extraCompact"
                  onCollapsedChange={(isCollapsed) => {
                    setExpandedItemIds((currentIds) =>
                      isCollapsed
                        ? currentIds.filter(
                            (currentId) => currentId !== item.id,
                          )
                        : [...currentIds, item.id],
                    );
                  }}
                  style={
                    row.id === highlightedTransactionId
                      ? styles.highlightedTile
                      : undefined
                  }
                  title={
                    <View style={styles.titleBlock}>
                      <Text
                        numberOfLines={2}
                        style={styles.transactionTitle}
                        testID={`transaction-summary-${index}`}
                      >
                        {item.summaryText}
                      </Text>
                      <Text style={styles.timestampText}>
                        {item.timestampLabel}
                      </Text>
                    </View>
                  }
                >
                  {row.kind === 'history-restored' ? (
                    <ActionPill
                      label="Jump To Original"
                      onPress={() => {
                        const targetTransactionId =
                          row.restoredToTransactionId ?? null;
                        const targetItem = findDisplayItemByTransactionId(
                          allDisplayItems,
                          targetTransactionId,
                        );

                        if (!targetItem || !targetTransactionId) {
                          return;
                        }

                        const targetRow =
                          targetItem.kind === 'group'
                            ? targetItem.rows.find(
                                (itemRow) => itemRow.id === targetTransactionId,
                              )
                            : targetItem.row;

                        setSelectedChildIds([]);
                        if (targetRow?.isOrphaned) {
                          setShowOrphaned(true);
                        }
                        setPendingJumpTargetId(targetTransactionId);
                      }}
                    />
                  ) : null}
                  {row.isOrphaned && !row.isRestorableNow ? (
                    <Text style={styles.metaCopy}>
                      This transaction lives on a diverged history branch. A
                      newer action sealed that branch, so it can no longer be
                      restored.
                    </Text>
                  ) : !row.isHead && !row.isRestorableNow ? (
                    <Text style={styles.metaCopy}>
                      {buildRestoreStatusCopy(row)}
                    </Text>
                  ) : null}
                  {row.isRestorableNow && row.kind !== 'history-restored' ? (
                    <ActionPill
                      label="Restore To This Point"
                      onPress={() => {
                        handleRestoreTransaction(row.id);
                      }}
                      tone="primary"
                    />
                  ) : null}
                </Tile>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

function deriveTransactionFilterChildren(document: SharedDocument) {
  const children = new Map<string, { id: string; name: string }>();

  for (const transaction of [...document.transactions].reverse()) {
    if (transaction.childId && transaction.childName) {
      children.set(transaction.childId, {
        id: transaction.childId,
        name: transaction.childName,
      });
    }
  }

  return [...children.values()];
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
    },
    filterToggleTextSelected: {
      color: tokens.textPrimary,
    },
    highlightedSubtile: {
      backgroundColor: tokens.accentSoft,
      borderColor: tokens.accent,
      borderWidth: 1,
    },
    highlightedTile: {
      borderColor: tokens.accent,
      borderWidth: 1,
    },
    metaCopy: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    subtile: {
      borderRadius: 12,
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    subtileHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'space-between',
    },
    subtileHeaderActions: {
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 0,
      gap: 6,
    },
    subtileExpanderButton: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 10,
      height: 20,
      justifyContent: 'center',
      width: 20,
    },
    subtileList: {
      gap: 4,
    },
    subtileTitle: {
      color: tokens.textPrimary,
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 15,
    },
    subtileTitleBlock: {
      flex: 1,
      gap: 1,
      minWidth: 0,
    },
    timestampText: {
      color: tokens.textMuted,
      fontSize: 11,
      lineHeight: 14,
    },
    titleBlock: {
      gap: 1,
    },
    transactionList: {
      gap: 4,
    },
    transactionTitle: {
      color: tokens.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
    },
  });
