import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Tile } from '../../components/Tile';
import { useAppStorage } from '../app/appStorage';
import {
  canRestoreTransaction,
  canRevertTransaction,
  getTransactionActivityEntries,
  getTransactionSummary,
  getVisibleTransactions,
} from '../app/transactions';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';

export function TransactionsScreen() {
  const router = useRouter();
  const { getScreenSurface, tokens } = useAppTheme();
  const {
    clearTransactionHistory,
    getRevertPlan,
    getRestorePlan,
    isHydrated,
    parentSession,
    restoreTransaction,
    revertTransaction,
    transactions,
  } = useAppStorage();
  const styles = useThemedStyles(createStyles);
  const [selectedTransactionId, setSelectedTransactionId] = useState<
    string | null
  >(null);
  const [isFocusedChainOnly, setIsFocusedChainOnly] = useState(false);

  useEffect(() => {
    if (!isHydrated || parentSession.isUnlocked) {
      return;
    }

    router.replace('/');
  }, [isHydrated, parentSession.isUnlocked, router]);

  useEffect(() => {
    if (selectedTransactionId === null) {
      return;
    }

    const stillExists = getVisibleTransactions(transactions).some(
      (transaction) => transaction.threadId === selectedTransactionId,
    );

    if (!stillExists) {
      setIsFocusedChainOnly(false);
      setSelectedTransactionId(null);
    }
  }, [selectedTransactionId, transactions]);

  const orderedTransactions = useMemo(
    () =>
      [...getVisibleTransactions(transactions)].sort(
        (left, right) => right.id - left.id,
      ),
    [transactions],
  );
  const selectedTransaction = useMemo(
    () =>
      selectedTransactionId === null
        ? null
        : (orderedTransactions.find(
            (transaction) => transaction.threadId === selectedTransactionId,
          ) ?? null),
    [orderedTransactions, selectedTransactionId],
  );
  const selectedActionPlan = useMemo(() => {
    if (!selectedTransaction) {
      return {
        mode: null as 'restore' | 'revert' | null,
        transactionIds: [] as string[],
      };
    }

    if (canRevertTransaction(selectedTransaction)) {
      return {
        mode: 'revert' as const,
        transactionIds: getRevertPlan(selectedTransaction.threadId),
      };
    }

    if (canRestoreTransaction(selectedTransaction)) {
      return {
        mode: 'restore' as const,
        transactionIds: getRestorePlan(selectedTransaction.threadId),
      };
    }

    return {
      mode: null as 'restore' | 'revert' | null,
      transactionIds: [] as string[],
    };
  }, [getRestorePlan, getRevertPlan, selectedTransaction]);
  const selectedRevertSet = useMemo(
    () => new Set(selectedActionPlan.transactionIds),
    [selectedActionPlan.transactionIds],
  );
  const focusedTransactionIds = useMemo(() => {
    if (!selectedTransaction) {
      return [] as string[];
    }

    if (selectedActionPlan.transactionIds.length > 0) {
      return selectedActionPlan.transactionIds;
    }

    return [selectedTransaction.threadId];
  }, [selectedActionPlan.transactionIds, selectedTransaction]);
  const focusedTransactionSet = useMemo(
    () => new Set(focusedTransactionIds),
    [focusedTransactionIds],
  );
  const visibleTransactions = useMemo(() => {
    if (!isFocusedChainOnly || !selectedTransaction) {
      return orderedTransactions;
    }

    return orderedTransactions.filter((transaction) =>
      focusedTransactionSet.has(transaction.threadId),
    );
  }, [
    focusedTransactionSet,
    isFocusedChainOnly,
    orderedTransactions,
    selectedTransaction,
  ]);

  if (!isHydrated || !parentSession.isUnlocked) {
    return null;
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safeArea,
        { backgroundColor: getScreenSurface(parentSession.isUnlocked) },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          tokens.layout.tabScreenContent,
          styles.compactContent,
        ]}
      >
        <ScreenHeader
          actions={
            <Pressable
              accessibilityLabel="Clear transaction history"
              onPress={() =>
                Alert.alert(
                  'Clear transaction history',
                  'Delete all saved transaction history? This should only be used during development. The current app state will stay as-is, but the log will be cleared.',
                  [
                    { style: 'cancel', text: 'Cancel' },
                    {
                      style: 'destructive',
                      text: 'Clear history',
                      onPress: () => {
                        clearTransactionHistory();
                        setIsFocusedChainOnly(false);
                        setSelectedTransactionId(null);
                      },
                    },
                  ],
                )
              }
              style={[
                styles.headerActionButton,
                { backgroundColor: tokens.controlSurface },
              ]}
            >
              <Ionicons
                color={tokens.controlText}
                name="trash-outline"
                size={18}
              />
            </Pressable>
          }
          leadingControl={
            <Pressable
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={[
                styles.headerActionButton,
                { backgroundColor: tokens.controlSurface },
              ]}
            >
              <Ionicons
                color={tokens.controlText}
                name="arrow-back-outline"
                size={20}
              />
            </Pressable>
          }
          subtitle="Shared history for kids and timer actions"
          title="Transactions"
        />

        {orderedTransactions.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              {
                backgroundColor: tokens.cardSurface,
                borderColor: tokens.border,
              },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
              No shared transactions yet
            </Text>
            <Text style={[styles.emptyBody, { color: tokens.textMuted }]}>
              Point changes, child updates, and shared timer events will appear
              here.
            </Text>
          </View>
        ) : null}

        {visibleTransactions.map((transaction) => {
          const isSelected = selectedTransactionId === transaction.threadId;
          const isInRevertChain =
            !isSelected && selectedRevertSet.has(transaction.threadId);
          const revertable = canRevertTransaction(transaction);
          const restorable = canRestoreTransaction(transaction);
          const selectedActionCount = isSelected
            ? selectedActionPlan.transactionIds.length
            : 0;
          const activityEntries = getTransactionActivityEntries(transaction);
          const selectedActionVerb =
            selectedActionPlan.mode === 'restore' ? 'restored' : 'reverted';
          const selectedActionDirection =
            selectedActionPlan.mode === 'restore' ? 'below' : 'above';
          const isSuperseded = transaction.supersededByThreadId !== null;

          return (
            <Tile
              key={transaction.id}
              accessibilityLabel={`Select transaction ${transaction.id}`}
              collapsed={!isSelected}
              compact
              containerStyle={[
                styles.row,
                isInRevertChain ? styles.rowLinked : styles.rowDefault,
                isSelected && {
                  borderColor: tokens.accentText,
                  shadowColor: tokens.shadowColor,
                  shadowOpacity: 0.12,
                },
              ]}
              initiallyCollapsed
              onCollapsedChange={(nextIsCollapsed) => {
                setIsFocusedChainOnly(false);
                setSelectedTransactionId(
                  nextIsCollapsed ? null : transaction.threadId,
                );
              }}
              title={renderTransactionTitle(
                transaction,
                transactions,
                styles,
                tokens,
              )}
            >
              <View style={styles.expandedContent}>
                <View style={styles.expandedTopRow}>
                  <Text style={[styles.meta, { color: tokens.textMuted }]}>
                    #{transaction.id} | {transaction.actorDeviceName} |{' '}
                    {formatTransactionTimestamp(transaction.occurredAt)}
                  </Text>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: isSuperseded
                          ? tokens.controlSurface
                          : transaction.status === 'reverted'
                            ? tokens.controlSurface
                            : transaction.undoPolicy === 'reversible'
                              ? tokens.accentSurface
                              : tokens.segmentedControlSurface,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.badgeText, { color: tokens.controlText }]}
                    >
                      {isSuperseded
                        ? 'Superseded'
                        : transaction.status === 'reverted'
                          ? 'Reverted'
                          : transaction.undoPolicy === 'reversible'
                            ? 'Undoable'
                            : 'Tracked'}
                    </Text>
                  </View>
                </View>

                {isSelected && isSuperseded ? (
                  <Text
                    style={[styles.supersededCopy, { color: tokens.textMuted }]}
                  >
                    A later archive or restore action for this child has
                    superseded this one.
                  </Text>
                ) : null}

                {isSelected && selectedActionCount > 1 ? (
                  <View style={styles.selectionHint}>
                    <Ionicons
                      color={tokens.controlTextOnActive}
                      name="sparkles-outline"
                      size={14}
                    />
                    <Text style={styles.selectionHintText}>
                      Highlighted actions {selectedActionDirection} will also be{' '}
                      {selectedActionVerb}.
                    </Text>
                  </View>
                ) : null}

                {isSelected && isFocusedChainOnly ? (
                  <Text
                    style={[
                      styles.focusedHintText,
                      { color: tokens.textMuted },
                    ]}
                  >
                    Showing only the affected actions for this chain.
                  </Text>
                ) : null}

                {isInRevertChain ? (
                  <Text
                    style={[styles.linkedCopy, { color: tokens.accentText }]}
                  >
                    Included in the selected{' '}
                    {selectedActionPlan.mode === 'restore'
                      ? 'restore'
                      : 'revert'}{' '}
                    chain
                  </Text>
                ) : null}

                {activityEntries.length > 0 ? (
                  <View style={styles.activityList}>
                    {activityEntries.map((entry) => (
                      <Text
                        key={entry.eventId}
                        style={[
                          styles.activityItem,
                          { color: tokens.textMuted },
                        ]}
                      >
                        {formatActivityLabel(entry.kind)} |{' '}
                        {entry.actorDeviceName} |{' '}
                        {formatTransactionTimestamp(entry.occurredAt)}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {revertable || restorable ? (
                  <View style={styles.rowActions}>
                    <Pressable
                      accessibilityLabel={
                        isFocusedChainOnly
                          ? 'Show all actions'
                          : 'Focus affected actions'
                      }
                      onPress={() => {
                        setIsFocusedChainOnly((current) => !current);
                      }}
                      style={[
                        styles.focusButton,
                        { backgroundColor: tokens.controlSurface },
                      ]}
                    >
                      <Ionicons
                        color={tokens.controlText}
                        name={
                          isFocusedChainOnly ? 'eye-off-outline' : 'eye-outline'
                        }
                        size={16}
                      />
                      <Text
                        style={[
                          styles.focusButtonText,
                          { color: tokens.controlText },
                        ]}
                      >
                        {isFocusedChainOnly ? 'Show all' : 'Focus'}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`${
                        restorable ? 'Restore' : 'Revert'
                      } transaction ${transaction.id}`}
                      onPress={() =>
                        restorable
                          ? restoreTransaction(transaction.threadId)
                          : revertTransaction(transaction.threadId)
                      }
                      style={[
                        styles.revertButton,
                        { backgroundColor: tokens.controlSurfaceActive },
                      ]}
                    >
                      <Text style={styles.revertButtonText}>
                        {selectedActionCount > 1
                          ? `${restorable ? 'Restore' : 'Revert'} ${selectedActionCount} actions`
                          : restorable
                            ? 'Restore'
                            : 'Revert'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {!(revertable || restorable) && isSelected ? (
                  <View style={styles.rowActions}>
                    <Pressable
                      accessibilityLabel={
                        isFocusedChainOnly
                          ? 'Show all actions'
                          : 'Focus affected actions'
                      }
                      onPress={() => {
                        setIsFocusedChainOnly((current) => !current);
                      }}
                      style={[
                        styles.focusButton,
                        { backgroundColor: tokens.controlSurface },
                      ]}
                    >
                      <Ionicons
                        color={tokens.controlText}
                        name={
                          isFocusedChainOnly ? 'eye-off-outline' : 'eye-outline'
                        }
                        size={16}
                      />
                      <Text
                        style={[
                          styles.focusButtonText,
                          { color: tokens.controlText },
                        ]}
                      >
                        {isFocusedChainOnly ? 'Show all' : 'Focus'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </Tile>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatTransactionTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
}

function formatActivityLabel(kind: 'action' | 'restore' | 'revert') {
  switch (kind) {
    case 'revert':
      return 'Reverted';
    case 'restore':
      return 'Restored';
    default:
      return 'Recorded';
  }
}

function renderTransactionTitle(
  transaction: Parameters<typeof canRevertTransaction>[0],
  transactions: Parameters<typeof getTransactionSummary>[1],
  styles: ReturnType<typeof createStyles>,
  tokens: ReturnType<typeof useAppTheme>['tokens'],
) {
  if (transaction.forward.type !== 'child-points-adjusted') {
    return getTransactionSummary(transaction, transactions);
  }

  const verb = transaction.forward.delta >= 0 ? '+' : '-';

  return (
    <View style={styles.pointTitleRow}>
      <Text numberOfLines={1} style={styles.pointTitle}>
        {transaction.forward.childName} {verb}
        {Math.abs(transaction.forward.delta)} points (
        {transaction.forward.previousPoints}
      </Text>
      <Ionicons
        color={tokens.controlTextMuted}
        name="chevron-forward"
        size={11}
        style={styles.pointArrowIcon}
      />
      <Text numberOfLines={1} style={styles.pointTitle}>
        {transaction.forward.nextPoints})
      </Text>
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    content: {},
    compactContent: {
      gap: 8,
      paddingBottom: 20,
    },
    emptyState: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
      gap: 6,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '900',
    },
    emptyBody: {
      fontSize: 14,
      lineHeight: 20,
    },
    row: {
      borderWidth: 1,
    },
    rowDefault: {
      borderColor: tokens.border,
    },
    headerActionButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    rowLinked: {
      backgroundColor: tokens.accentSurface,
      borderColor: tokens.controlSurfaceActive,
      borderWidth: 2,
      shadowColor: tokens.shadowColor,
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      elevation: 3,
    },
    expandedContent: {
      gap: 8,
    },
    expandedTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    meta: {
      flex: 1,
      fontSize: 12,
      lineHeight: 16,
    },
    pointTitle: {
      fontSize: 15,
      fontWeight: '800',
      flexShrink: 1,
      color: tokens.textPrimary,
    },
    pointTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      minWidth: 0,
    },
    pointArrowIcon: {
      marginHorizontal: 2,
    },
    linkedCopy: {
      fontSize: 12,
      fontWeight: '700',
    },
    supersededCopy: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
    },
    selectionHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: tokens.controlSurfaceActive,
    },
    selectionHintText: {
      flex: 1,
      color: tokens.controlTextOnActive,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
    },
    activityList: {
      gap: 4,
    },
    activityItem: {
      fontSize: 12,
      lineHeight: 16,
    },
    focusedHintText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
    },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      justifyContent: 'flex-end',
    },
    focusButton: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    focusButtonText: {
      fontSize: 13,
      fontWeight: '700',
    },
    revertButton: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    revertButtonText: {
      color: tokens.controlTextOnActive,
      fontSize: 13,
      fontWeight: '800',
    },
  });
