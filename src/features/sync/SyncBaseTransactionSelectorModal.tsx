import { StyleSheet, Text, View } from 'react-native';

import { ListScaffold } from '../../components/ListScaffold';
import { LoggedPressable } from '../../components/LoggedPressable';
import { StatusBadge } from '../../components/Skeleton';
import { type useAppTheme, useThemedStyles } from '../theme/appTheme';
import type { SyncTestbedCommonBaseOption } from './syncTestbedFixtures';

export function SyncBaseTransactionSelectorModal({
  onRequestClose,
  onSelectTransaction,
  options,
  selectedTransactionId,
  visible,
}: {
  onRequestClose: () => void;
  onSelectTransaction: (transactionId: string) => void;
  options: SyncTestbedCommonBaseOption[];
  selectedTransactionId: string | null;
  visible: boolean;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <ListScaffold
      closeButtonPlacement="footer"
      onRequestClose={onRequestClose}
      subtitle="Only active syncable history points are shown here so the simulator can branch from a real shared ancestry."
      title="Shared Base Transaction"
      visible={visible}
    >
      {options.map((option) => {
        const isSelected = option.id === selectedTransactionId;
        const isDisabled = !option.isMergeSafe;

        return (
          <LoggedPressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled, selected: isSelected }}
            logContext={{
              isMergeSafe: option.isMergeSafe,
              transactionId: option.id,
            }}
            logLabel={`Select shared base transaction ${option.summaryText}`}
            onPress={() => {
              if (isDisabled) {
                return;
              }

              onSelectTransaction(option.id);
            }}
            style={[
              styles.optionCard,
              isSelected && styles.optionCardSelected,
              isDisabled && styles.optionCardDisabled,
            ]}
          >
            <View style={styles.optionHeader}>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{option.summaryText}</Text>
                <Text style={styles.optionTimestamp}>
                  {option.timestampLabel}
                </Text>
              </View>
              <View style={styles.badgeRow}>
                {option.isHead ? (
                  <StatusBadge label="HEAD" size="mini" tone="good" />
                ) : null}
                <StatusBadge
                  label={option.isMergeSafe ? 'MERGE SAFE' : 'UNAVAILABLE'}
                  size="mini"
                  tone={option.isMergeSafe ? 'neutral' : 'warning'}
                />
              </View>
            </View>
            {option.disabledReason ? (
              <Text style={styles.disabledCopy}>{option.disabledReason}</Text>
            ) : null}
          </LoggedPressable>
        );
      })}
    </ListScaffold>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    badgeRow: {
      alignItems: 'flex-end',
      flexShrink: 0,
      gap: 6,
    },
    disabledCopy: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    optionCard: {
      backgroundColor: tokens.tileSurface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    optionCardDisabled: {
      opacity: 0.68,
    },
    optionCardSelected: {
      borderColor: tokens.accent,
      backgroundColor: tokens.accentSoft,
    },
    optionCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    optionHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    optionTimestamp: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    optionTitle: {
      color: tokens.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
    },
  });
