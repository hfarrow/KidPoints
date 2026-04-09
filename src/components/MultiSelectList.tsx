import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type useAppTheme, useThemedStyles } from '../features/theme/appTheme';
import { ListScaffold } from './ListScaffold';
import { LoggedPressable } from './LoggedPressable';
import { ActionPill, ActionPillRow, StatusBadge } from './Skeleton';

type MultiSelectListProps<T> = {
  closeLabel?: string;
  disableLogging?: boolean;
  emptyState?: ReactNode;
  footer?: ReactNode;
  getItemDescription?: (item: T, index: number) => string | null | undefined;
  getItemLabel: (item: T, index: number) => string;
  items: T[];
  keyExtractor: (item: T, index: number) => string;
  onRequestClose: () => void;
  onToggle: (item: T, index: number) => void;
  renderItemContent?: (args: {
    index: number;
    isSelected: boolean;
    item: T;
  }) => ReactNode;
  selectedItemIds: string[];
  subtitle?: string;
  title: string;
  utilityActions?: ReactNode;
  visible: boolean;
};

export function MultiSelectList<T>({
  closeLabel = 'Done',
  disableLogging = false,
  emptyState,
  footer,
  getItemDescription,
  getItemLabel,
  items,
  keyExtractor,
  onRequestClose,
  onToggle,
  renderItemContent,
  selectedItemIds,
  subtitle,
  title,
  utilityActions,
  visible,
}: MultiSelectListProps<T>) {
  const styles = useThemedStyles(createStyles);
  const visibleItems = items.map((item, index) => ({ index, item }));
  const selectedItemIdSet = new Set(selectedItemIds);
  const hasSelectedItems = visibleItems.some(({ index, item }) =>
    selectedItemIdSet.has(keyExtractor(item, index)),
  );
  const hasUnselectedItems = visibleItems.some(
    ({ index, item }) => !selectedItemIdSet.has(keyExtractor(item, index)),
  );

  const handleSelectAll = () => {
    visibleItems.forEach(({ index, item }) => {
      const itemId = keyExtractor(item, index);

      if (!selectedItemIdSet.has(itemId)) {
        onToggle(item, index);
      }
    });
  };

  const handleSelectNone = () => {
    visibleItems.forEach(({ index, item }) => {
      const itemId = keyExtractor(item, index);

      if (selectedItemIdSet.has(itemId)) {
        onToggle(item, index);
      }
    });
  };

  return (
    <ListScaffold
      closeButtonPlacement="footer"
      closeTone="warning"
      closeLabel={closeLabel}
      disableLogging={disableLogging}
      emptyState={emptyState}
      footer={footer}
      onRequestClose={onRequestClose}
      subtitle={subtitle}
      title={title}
      utilityBar={
        items.length > 0 || utilityActions ? (
          <ActionPillRow>
            {items.length > 0 ? (
              <ActionPill
                disableLogging={disableLogging}
                label="Select None"
                onPress={hasSelectedItems ? handleSelectNone : undefined}
              />
            ) : null}
            {items.length > 0 ? (
              <ActionPill
                disableLogging={disableLogging}
                label="Select All"
                onPress={hasUnselectedItems ? handleSelectAll : undefined}
              />
            ) : null}
            {utilityActions}
          </ActionPillRow>
        ) : undefined
      }
      visible={visible}
    >
      {visibleItems.length > 0 ? (
        <View style={styles.list}>
          {visibleItems.map(({ index, item }) => {
            const itemId = keyExtractor(item, index);
            const isSelected = selectedItemIds.includes(itemId);
            const label = getItemLabel(item, index);
            const description = getItemDescription?.(item, index);
            const accessibilityLabel = `${isSelected ? 'Selected' : 'Select'} ${label}`;

            return (
              <LoggedPressable
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                disableLogging={disableLogging}
                key={itemId}
                logContext={{ itemId, selected: isSelected, title }}
                logLabel={`Toggle ${label}`}
                onPress={() => onToggle(item, index)}
                style={[styles.row, isSelected && styles.rowSelected]}
              >
                <View style={styles.rowCopy}>
                  {renderItemContent ? (
                    renderItemContent({ index, isSelected, item })
                  ) : (
                    <>
                      <Text style={styles.rowTitle}>{label}</Text>
                      {description ? (
                        <Text style={styles.rowDescription}>{description}</Text>
                      ) : null}
                    </>
                  )}
                </View>
                <View style={styles.selectionBadgeSlot}>
                  {isSelected ? (
                    <StatusBadge label="Selected" size="mini" />
                  ) : null}
                </View>
              </LoggedPressable>
            );
          })}
        </View>
      ) : null}
    </ListScaffold>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    list: {
      gap: 8,
    },
    row: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
      minHeight: 44,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    rowCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    rowDescription: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    rowSelected: {
      backgroundColor: tokens.accentSoft,
      borderColor: tokens.accent,
    },
    rowTitle: {
      color: tokens.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    selectionBadgeSlot: {
      alignItems: 'flex-end',
      flexShrink: 0,
      height: 20,
      justifyContent: 'center',
      width: 72,
    },
  });
