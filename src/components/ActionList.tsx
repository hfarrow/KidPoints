import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { type useAppTheme, useThemedStyles } from '../features/theme/appTheme';
import { ListScaffold } from './ListScaffold';

type ActionListProps<T> = {
  closeLabel?: string;
  emptyState?: ReactNode;
  footer?: ReactNode;
  items: T[];
  keyExtractor: (item: T, index: number) => string;
  onRequestClose: () => void;
  renderItem: (args: { index: number; item: T }) => ReactNode;
  subtitle?: string;
  title: string;
  visible: boolean;
};

export function ActionList<T>({
  closeLabel,
  emptyState,
  footer,
  items,
  keyExtractor,
  onRequestClose,
  renderItem,
  subtitle,
  title,
  visible,
}: ActionListProps<T>) {
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
          {items.map((item, index) => (
            <View key={keyExtractor(item, index)}>
              {renderItem({ index, item })}
            </View>
          ))}
        </View>
      ) : null}
    </ListScaffold>
  );
}

const createStyles = (_theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    list: {
      gap: 8,
    },
  });
