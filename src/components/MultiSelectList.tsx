import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type useAppTheme, useThemedStyles } from '../features/theme/appTheme';
import { ListScaffold } from './ListScaffold';
import { LoggedPressable } from './LoggedPressable';
import { StatusBadge } from './Skeleton';

type MultiSelectListProps<T> = {
  closeLabel?: string;
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
  visible: boolean;
};

export function MultiSelectList<T>({
  closeLabel,
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
  visible,
}: MultiSelectListProps<T>) {
  const styles = useThemedStyles(createStyles);

  return (
    <ListScaffold
      closeLabel={closeLabel}
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
            const isSelected = selectedItemIds.includes(itemId);
            const label = getItemLabel(item, index);
            const description = getItemDescription?.(item, index);

            return (
              <LoggedPressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
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
                {isSelected ? (
                  <StatusBadge label="Included" size="mini" />
                ) : null}
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
  });
