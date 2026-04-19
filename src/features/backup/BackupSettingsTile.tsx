import { useEffect } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  ActionPill,
  ActionPillRow,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { useSessionUiStore } from '../../state/sessionUiStore';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import { useBackup } from './BackupProvider';

function deriveBackupBadge(hasLocalBackup: boolean) {
  return hasLocalBackup
    ? {
        label: 'Saved',
        tone: 'good' as const,
      }
    : {
        label: 'Missing',
        tone: 'neutral' as const,
      };
}

export function BackupSettingsTile() {
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const {
    exportBackup,
    importBackup,
    internalBackupUri,
    lastError,
    localBackup,
    refreshBackupStatus,
    restoreLocalBackup,
  } = useBackup();
  const lockSessionParentMode = useSessionUiStore(
    (state) => state.lockParentMode,
  );
  const badge = deriveBackupBadge(Boolean(localBackup));

  useEffect(() => {
    void refreshBackupStatus();
  }, [refreshBackupStatus]);

  const handleExportBackup = async () => {
    const result = await exportBackup();

    if (!result.ok && !result.cancelled) {
      Alert.alert('Export Failed', result.error);
    }
  };

  const handleRestoreResult = (
    result: Awaited<ReturnType<typeof importBackup>>,
    failureTitle: string,
  ) => {
    if (!result.ok) {
      if (!result.cancelled) {
        Alert.alert(failureTitle, result.error);
      }
      return;
    }

    lockSessionParentMode();
  };

  const confirmImport = () => {
    Alert.alert(
      'Import Backup',
      'Choose a backup file to import. This replaces the current shared state and relocks parent mode.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          style: 'destructive',
          text: 'Import',
          onPress: () => {
            void importBackup().then((result) => {
              handleRestoreResult(result, 'Import Failed');
            });
          },
        },
      ],
    );
  };

  const confirmRestoreLocal = () => {
    Alert.alert(
      'Restore Local Backup',
      'Restore the internal backup file. This replaces the current shared state and relocks parent mode.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          style: 'destructive',
          text: 'Restore',
          onPress: () => {
            void restoreLocalBackup().then((result) => {
              handleRestoreResult(result, 'Restore Failed');
            });
          },
        },
      ],
    );
  };

  return (
    <Tile
      accessory={<StatusBadge label={badge.label} tone={badge.tone} />}
      title="Backup"
    >
      <View style={styles.section}>
        <View style={styles.pathRow}>
          <Text style={styles.label}>Internal Backup</Text>
          <Text selectable style={styles.path}>
            {internalBackupUri}
          </Text>
        </View>

        {lastError ? (
          <Text style={[styles.errorText, { color: tokens.accent }]}>
            {lastError}
          </Text>
        ) : null}
      </View>

      <ActionPillRow>
        <ActionPill label="Import" onPress={confirmImport} tone="critical" />
        <ActionPill
          label="Restore Local"
          onPress={confirmRestoreLocal}
          tone="critical"
        />
        <ActionPill
          label="Export"
          onPress={() => {
            void handleExportBackup();
          }}
          tone="primary"
        />
      </ActionPillRow>
    </Tile>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    errorText: {
      fontSize: 12,
      lineHeight: 18,
    },
    label: {
      color: tokens.textPrimary,
      fontSize: 12,
      fontWeight: '600',
    },
    path: {
      color: tokens.textMuted,
      fontFamily: 'monospace',
      fontSize: 11,
      lineHeight: 16,
    },
    pathRow: {
      gap: 4,
    },
    section: {
      gap: 12,
    },
  });
