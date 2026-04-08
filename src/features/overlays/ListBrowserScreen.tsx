import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { LoggedPressable } from '../../components/LoggedPressable';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  CompactSurface,
  SectionLabel,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { createModuleLogger } from '../../logging/logger';
import { useSharedStore } from '../../state/sharedStore';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';

const log = createModuleLogger('list-browser-screen');

export function ListBrowserScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const head = useSharedStore((state) => state.document.head);
  const deleteChildPermanently = useSharedStore(
    (state) => state.deleteChildPermanently,
  );
  const restoreChild = useSharedStore((state) => state.restoreChild);
  const archivedChildren = useMemo(
    () =>
      head.archivedChildIds
        .map((childId) => head.childrenById[childId])
        .filter(Boolean),
    [head],
  );

  useEffect(() => {
    log.debug('List browser screen initialized');
  }, []);

  return (
    <ScreenScaffold>
      <ScreenHeader
        leadingAction={
          <LoggedPressable
            accessibilityLabel="Go Back"
            logLabel="Go Back"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Feather color={tokens.controlText} name="arrow-left" size={18} />
          </LoggedPressable>
        }
        title="Archived Children"
      />

      {archivedChildren.length === 0 ? (
        <Tile title="Nothing Archived">
          <Text style={styles.emptyCopy}>
            Archived children will appear here once you move them off the Home
            dashboard.
          </Text>
        </Tile>
      ) : (
        <Tile title="Restore Children">
          <View style={styles.column}>
            {archivedChildren.map((child) => (
              <CompactSurface key={child.id}>
                <SectionLabel>{child.name}</SectionLabel>
                <Text style={styles.rowText}>{`${child.points} points`}</Text>
                <Text style={styles.metaText}>
                  {child.archivedAt
                    ? `Archived ${new Date(child.archivedAt).toLocaleString()}`
                    : 'Archived child'}
                </Text>
                <View style={styles.actionRow}>
                  <ActionPill
                    label="Restore to Home"
                    onPress={() => {
                      restoreChild(child.id);
                    }}
                    tone="primary"
                  />
                  <ActionPill
                    label="Delete Permanently"
                    onPress={() => {
                      Alert.alert(
                        'Delete Child Permanently',
                        `${child.name} will be removed forever. Their archived profile and recorded data will no longer be available after this action.`,
                        [
                          { style: 'cancel', text: 'Cancel' },
                          {
                            onPress: () => {
                              deleteChildPermanently(child.id);
                            },
                            style: 'destructive',
                            text: 'Delete Permanently',
                          },
                        ],
                      );
                    }}
                    tone="critical"
                  />
                </View>
              </CompactSurface>
            ))}
          </View>
        </Tile>
      )}
    </ScreenScaffold>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    backButton: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    column: {
      gap: 8,
    },
    emptyCopy: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    metaText: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    rowText: {
      color: tokens.textPrimary,
      fontSize: 14,
      lineHeight: 20,
    },
  });
