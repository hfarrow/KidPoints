import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LoggedPressable } from '../../components/LoggedPressable';
import { ActionPill, StatusBadge } from '../../components/Skeleton';
import { isBlockingRouteModalPath } from '../../navigation/modalPaths';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import {
  clearListPickerModal,
  useListPickerModalStore,
} from './listPickerModalStore';

export function ListPickerModal() {
  const pathname = usePathname();
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const clearRequest = useListPickerModalStore((state) => state.clearRequest);
  const request = useListPickerModalStore((state) => state.request);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    return () => {
      clearListPickerModal();
    };
  }, []);

  const isVisible = !!request && !isBlockingRouteModalPath(pathname);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        clearRequest();
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [clearRequest, isVisible]);

  useEffect(() => {
    if (!request) {
      setSelectedItemIds(new Set());
      return;
    }

    const nextSelectedItemIds =
      (request.selectionMode ?? 'single') === 'multiple'
        ? new Set(request.selectedItemIds ?? [])
        : new Set(
            request.selectedItemId != null ? [request.selectedItemId] : [],
          );

    setSelectedItemIds(nextSelectedItemIds);
  }, [request]);

  if (!request || !isVisible) {
    return null;
  }

  const selectionMode = request.selectionMode ?? 'single';
  const closeLabel =
    request.closeLabel ?? (selectionMode === 'multiple' ? 'Close' : 'Cancel');

  return (
    <View style={styles.overlayRoot} testID="list-picker-modal">
      <LoggedPressable
        accessibilityLabel="Close list picker"
        disableLogging
        logLabel="Close list picker"
        onPress={() => clearRequest()}
        style={[styles.backdrop, { backgroundColor: tokens.modalBackdrop }]}
      >
        <View style={styles.backdropFill} />
      </LoggedPressable>
      <View style={styles.sheetWrap}>
        <View style={styles.card}>
          <Text style={styles.title}>{request.title}</Text>
          <ScrollView
            contentContainerStyle={styles.optionList}
            style={styles.optionScrollView}
          >
            {request.items.map((item) => {
              const isSelected = selectedItemIds.has(item.id);

              return (
                <LoggedPressable
                  accessibilityLabel={`${isSelected ? 'Selected' : 'Select'} ${item.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  disableLogging
                  key={item.id}
                  logContext={{
                    itemId: item.id,
                    selected: isSelected,
                    title: request.title,
                  }}
                  logLabel={`Select ${item.label}`}
                  onPress={() => {
                    setSelectedItemIds((currentIds) => {
                      if (selectionMode === 'multiple') {
                        const nextIds = new Set(currentIds);

                        if (nextIds.has(item.id)) {
                          nextIds.delete(item.id);
                        } else {
                          nextIds.add(item.id);
                        }

                        return nextIds;
                      }

                      return new Set([item.id]);
                    });
                    request.onSelect(item.id);
                    if (selectionMode === 'single') {
                      clearRequest();
                    }
                  }}
                  style={[styles.option, isSelected && styles.optionSelected]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      isSelected && styles.optionLabelSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isSelected ? (
                    <StatusBadge label="Selected" size="mini" tone="good" />
                  ) : null}
                </LoggedPressable>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            <ActionPill
              disableLogging
              label={closeLabel}
              onPress={() => clearRequest()}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    backdropFill: {
      ...StyleSheet.absoluteFillObject,
    },
    card: {
      backgroundColor: tokens.modalSurface,
      borderColor: tokens.border,
      borderRadius: 22,
      borderWidth: 1,
      gap: 12,
      maxHeight: '80%',
      maxWidth: 420,
      paddingHorizontal: 18,
      paddingVertical: 18,
      width: '100%',
    },
    footer: {
      alignItems: 'flex-end',
    },
    option: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
      minHeight: 44,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    optionLabel: {
      color: tokens.textPrimary,
      flex: 1,
      fontSize: 14,
      fontWeight: '800',
      minWidth: 0,
    },
    optionLabelSelected: {
      color: tokens.textPrimary,
    },
    optionList: {
      gap: 8,
    },
    optionScrollView: {
      flexGrow: 0,
    },
    optionSelected: {
      backgroundColor: tokens.accentSoft,
      borderColor: tokens.accent,
    },
    overlayRoot: {
      ...StyleSheet.absoluteFillObject,
      elevation: 1000,
      justifyContent: 'flex-end',
      padding: 18,
      zIndex: 1000,
    },
    sheetWrap: {
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    title: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
  });
