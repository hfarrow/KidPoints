import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type useAppTheme, useThemedStyles } from '../features/theme/appTheme';
import { ListScaffold } from './ListScaffold';
import { LoggedPressable } from './LoggedPressable';
import { StatusBadge } from './Skeleton';

type SingleSelectListProps<T> = {
  closeLabel?: string;
  disableLogging?: boolean;
  emptyState?: ReactNode;
  footer?: ReactNode;
  getItemDescription?: (item: T, index: number) => string | null | undefined;
  getItemLabel: (item: T, index: number) => string;
  items: T[];
  keyExtractor: (item: T, index: number) => string;
  onRequestClose: () => void;
  onSelect: (item: T, index: number) => void;
  renderItemContent?: (args: {
    index: number;
    isSelected: boolean;
    item: T;
  }) => ReactNode;
  selectedItemId: string | null;
  subtitle?: string;
  title: string;
  visible: boolean;
};

export function SingleSelectList<T>({
  closeLabel = 'Back',
  disableLogging = false,
  emptyState,
  footer,
  getItemDescription,
  getItemLabel,
  items,
  keyExtractor,
  onRequestClose,
  onSelect,
  renderItemContent,
  selectedItemId,
  subtitle,
  title,
  visible,
}: SingleSelectListProps<T>) {
  const styles = useThemedStyles(createStyles);

  return (
    <ListScaffold
      closeTone="warning"
      closeLabel={closeLabel}
      disableLogging={disableLogging}
      emptyState={emptyState}
      footer={footer}
      onRequestClose={onRequestClose}
      subtitle={subtitle}
      title={title}
      visible={visible}
    >
      {items.length > 0 ? (
        <View style={styles.list}>
          {items.map((item, index) => {
            const itemId = keyExtractor(item, index);
            const isSelected = itemId === selectedItemId;
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
                logLabel={`Select ${label}`}
                onPress={() => onSelect(item, index)}
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
