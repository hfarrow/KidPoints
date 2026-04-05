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
  canRevertTransaction,
  getTransactionSummary,
} from '../app/transactions';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';

export function TransactionsScreen() {
  const router = useRouter();
  const { getScreenSurface, tokens } = useAppTheme();
  const {
    clearTransactionHistory,
    getRevertPlan,
    isHydrated,
    parentSession,
    revertTransaction,
    transactions,
  } = useAppStorage();
  const styles = useThemedStyles(createStyles);
  const [selectedTransactionId, setSelectedTransactionId] = useState<
    number | null
  >(null);

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

    const stillExists = transactions.some(
      (transaction) => transaction.id === selectedTransactionId,
    );

    if (!stillExists) {
      setSelectedTransactionId(null);
    }
  }, [selectedTransactionId, transactions]);

  const orderedTransactions = useMemo(
    () => [...transactions].sort((left, right) => right.id - left.id),
    [transactions],
  );
  const selectedRevertPlan = useMemo(
    () =>
      selectedTransactionId === null
        ? []
        : getRevertPlan(selectedTransactionId),
    [getRevertPlan, selectedTransactionId],
  );
  const selectedRevertSet = useMemo(
    () => new Set(selectedRevertPlan),
    [selectedRevertPlan],
  );

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

        {orderedTransactions.map((transaction) => {
          const isSelected = selectedTransactionId === transaction.id;
          const isInRevertChain =
            !isSelected && selectedRevertSet.has(transaction.id);
          const revertable = canRevertTransaction(transaction);
          const revertCount = isSelected ? selectedRevertPlan.length : 0;

          return (
            <Tile
              key={transaction.id}
              accessibilityLabel={`Select transaction ${transaction.id}`}
              collapsed={!isSelected}
              compact
              containerStyle={[
                styles.row,
                {
                  borderColor: tokens.border,
                },
                isSelected && {
                  borderColor: tokens.accentText,
                  shadowColor: tokens.shadowColor,
                  shadowOpacity: 0.12,
                },
                isInRevertChain && styles.rowLinked,
              ]}
              initiallyCollapsed
              onCollapsedChange={(nextIsCollapsed) => {
                setSelectedTransactionId(
                  nextIsCollapsed ? null : transaction.id,
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
                        backgroundColor:
                          transaction.status === 'reverted'
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
                      {transaction.status === 'reverted'
                        ? 'Reverted'
                        : transaction.undoPolicy === 'reversible'
                          ? 'Undoable'
                          : 'Tracked'}
                    </Text>
                  </View>
                </View>

                {isInRevertChain ? (
                  <Text
                    style={[styles.linkedCopy, { color: tokens.accentText }]}
                  >
                    Included in the selected revert chain
                  </Text>
                ) : null}

                {revertable ? (
                  <View style={styles.rowActions}>
                    <Pressable
                      accessibilityLabel={`Revert transaction ${transaction.id}`}
                      onPress={() => revertTransaction(transaction.id)}
                      style={[
                        styles.revertButton,
                        { backgroundColor: tokens.controlSurfaceActive },
                      ]}
                    >
                      <Text style={styles.revertButtonText}>
                        {revertCount > 1
                          ? `Revert ${revertCount} actions`
                          : 'Revert'}
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
    headerActionButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    rowLinked: {
      borderStyle: 'dashed',
      opacity: 0.9,
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
    rowActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
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
