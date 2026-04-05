import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  type useAppTheme,
  useThemedStyles,
} from '../features/theme/themeContext';

type ListModalProps<T> = {
  data: T[];
  emptyMessage: string;
  keyExtractor: (item: T, index: number) => string;
  onClose: () => void;
  renderItem: (item: T, index: number) => ReactNode;
  title: string;
  visible: boolean;
};

export function ListModal<T>({
  data,
  emptyMessage,
  keyExtractor,
  onClose,
  renderItem,
  title,
  visible,
}: ListModalProps<T>) {
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              accessibilityLabel={`Close ${title}`}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Done</Text>
            </Pressable>
          </View>

          {data.length === 0 ? (
            <Text style={styles.emptyMessage}>{emptyMessage}</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {data.map((item, index) => (
                <View key={keyExtractor(item, index)} style={styles.row}>
                  {renderItem(item, index)}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: tokens.modalBackdrop,
    },
    card: {
      width: '100%',
      maxWidth: 440,
      maxHeight: '80%',
      borderRadius: 24,
      padding: 24,
      gap: 16,
      backgroundColor: tokens.modalSurface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: {
      flex: 1,
      fontSize: 24,
      fontWeight: '900',
      color: tokens.textPrimary,
    },
    closeButton: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 18,
      paddingVertical: 10,
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
    },
    closeButtonText: {
      fontWeight: '800',
      color: tokens.controlText,
    },
    content: {
      gap: 10,
    },
    row: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 14,
      borderColor: tokens.border,
      backgroundColor: tokens.cardSurface,
    },
    emptyMessage: {
      fontSize: 15,
      lineHeight: 22,
      color: tokens.textMuted,
    },
  });
