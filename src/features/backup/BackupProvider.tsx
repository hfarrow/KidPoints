import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createModuleLogger } from '../../logging/logger';
import { useSharedStore } from '../../state/sharedStore';
import {
  type BackupMetadata,
  type BackupReason,
  createSharedBackupPayload,
  type LocalBackupSnapshot,
} from './backupModels';
import {
  getLocalBackupFileUri,
  readBackupStorageMetadata,
  readLocalBackup,
  writeBackupStorageMetadata,
  writeLocalBackup,
} from './localBackup';
import {
  exportBackupToPickedDirectory,
  importBackupFromPickedFile,
  isBackupPickerCancelled,
} from './portableBackup';

type BackupOperationResult =
  | {
      cancelled?: false;
      metadata: BackupMetadata | null;
      ok: true;
      source: 'local' | 'portable';
    }
  | {
      cancelled?: boolean;
      error: string;
      ok: false;
    };

type CreateBackupResult =
  | {
      metadata: BackupMetadata | null;
      ok: true;
      source: 'local';
    }
  | {
      error: string;
      ok: false;
    };

type BackupContextValue = {
  createBackup: (reason: BackupReason) => Promise<CreateBackupResult>;
  exportBackup: () => Promise<BackupOperationResult>;
  importBackup: () => Promise<BackupOperationResult>;
  internalBackupUri: string;
  lastError: string | null;
  lastExportUri: string | null;
  localBackup: LocalBackupSnapshot | null;
  refreshBackupStatus: () => Promise<void>;
  restoreLocalBackup: () => Promise<BackupOperationResult>;
};

const BackupContext = createContext<BackupContextValue | null>(null);
const log = createModuleLogger('backup-provider');

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function toFailureResult(error: string): BackupOperationResult {
  return {
    error,
    ok: false,
  };
}

function toCancelledResult(message: string): BackupOperationResult {
  return {
    cancelled: true,
    error: message,
    ok: false,
  };
}

export function BackupProvider({ children }: PropsWithChildren) {
  const document = useSharedStore((state) => state.document);
  const restoreDocumentFromBackup = useSharedStore(
    (state) => state.restoreDocumentFromBackup,
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastExportUri, setLastExportUri] = useState<string | null>(null);
  const [localBackup, setLocalBackup] = useState<LocalBackupSnapshot | null>(
    null,
  );
  const documentRef = useRef(document);
  const internalBackupUri = getLocalBackupFileUri();

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  const refreshBackupStatus = useCallback(async () => {
    const localResult = readLocalBackup();
    const metadata = readBackupStorageMetadata();

    setLastExportUri(metadata.lastExportUri);

    if (localResult.ok) {
      setLocalBackup(localResult.snapshot);
      setLastError(null);
      return;
    }

    if (localResult.reason === 'missing') {
      setLocalBackup(null);
      setLastError(null);
      return;
    }

    setLocalBackup(null);
    setLastError(localResult.error);
  }, []);

  const createBackup = useCallback(
    async (reason: BackupReason): Promise<CreateBackupResult> => {
      const payload = createSharedBackupPayload({
        document: documentRef.current,
        reason,
      });

      try {
        const localSnapshot = writeLocalBackup(payload);

        setLocalBackup(localSnapshot);
        setLastError(null);
        log.info('Local backup written', {
          createdAt: localSnapshot.createdAt,
          reason,
        });

        return {
          metadata: localSnapshot,
          ok: true,
          source: 'local',
        };
      } catch (error) {
        const errorMessage = getErrorMessage(error);

        setLastError(errorMessage);
        log.error('Local backup write failed', {
          error: errorMessage,
          reason,
        });

        return {
          error: errorMessage,
          ok: false,
        };
      }
    },
    [],
  );

  const exportBackup = useCallback(async (): Promise<BackupOperationResult> => {
    const payload = createSharedBackupPayload({
      document: documentRef.current,
      reason: 'manual',
    });

    try {
      const localSnapshot = writeLocalBackup(payload);
      const exportedFile = await exportBackupToPickedDirectory(payload);
      writeBackupStorageMetadata({
        lastExportUri: exportedFile.uri,
      });

      setLocalBackup(localSnapshot);
      setLastExportUri(exportedFile.uri);
      setLastError(null);
      log.info('Portable backup exported', {
        createdAt: localSnapshot.createdAt,
        exportUri: exportedFile.uri,
      });

      return {
        metadata: localSnapshot,
        ok: true,
        source: 'portable',
      };
    } catch (error) {
      if (isBackupPickerCancelled(error)) {
        return toCancelledResult('Backup export was canceled.');
      }

      const errorMessage = getErrorMessage(error);

      setLastError(errorMessage);
      log.error('Portable backup export failed', {
        error: errorMessage,
      });
      return toFailureResult(errorMessage);
    }
  }, []);

  const importBackup = useCallback(async (): Promise<BackupOperationResult> => {
    try {
      const importedBackup = await importBackupFromPickedFile();
      const localSnapshot = writeLocalBackup(importedBackup.payload);
      const restoreResult = restoreDocumentFromBackup(
        importedBackup.payload.document,
      );

      if (!restoreResult.ok) {
        setLastError(restoreResult.error);
        return toFailureResult(restoreResult.error);
      }

      setLocalBackup(localSnapshot);
      setLastError(null);
      log.info('Portable backup imported', {
        createdAt: localSnapshot.createdAt,
        importUri: importedBackup.uri,
      });

      return {
        metadata: localSnapshot,
        ok: true,
        source: 'local',
      };
    } catch (error) {
      if (isBackupPickerCancelled(error)) {
        return toCancelledResult('Backup import was canceled.');
      }

      const errorMessage = getErrorMessage(error);

      setLastError(errorMessage);
      log.error('Portable backup import failed', {
        error: errorMessage,
      });
      return toFailureResult(errorMessage);
    }
  }, [restoreDocumentFromBackup]);

  const restoreLocalBackup =
    useCallback(async (): Promise<BackupOperationResult> => {
      const localResult = readLocalBackup();

      if (!localResult.ok) {
        setLastError(localResult.error);
        return toFailureResult(localResult.error);
      }

      const restoreResult = restoreDocumentFromBackup(
        localResult.payload.document,
      );

      if (!restoreResult.ok) {
        setLastError(restoreResult.error);
        return toFailureResult(restoreResult.error);
      }

      setLocalBackup(localResult.snapshot);
      setLastError(null);
      log.info('Local backup restored', {
        createdAt: localResult.snapshot.createdAt,
      });

      return {
        metadata: localResult.snapshot,
        ok: true,
        source: 'local',
      };
    }, [restoreDocumentFromBackup]);

  useEffect(() => {
    void refreshBackupStatus();
  }, [refreshBackupStatus]);

  const contextValue = useMemo<BackupContextValue>(
    () => ({
      createBackup,
      exportBackup,
      importBackup,
      internalBackupUri,
      lastError,
      lastExportUri,
      localBackup,
      refreshBackupStatus,
      restoreLocalBackup,
    }),
    [
      createBackup,
      exportBackup,
      importBackup,
      internalBackupUri,
      lastError,
      lastExportUri,
      localBackup,
      refreshBackupStatus,
      restoreLocalBackup,
    ],
  );

  return (
    <BackupContext.Provider value={contextValue}>
      {children}
    </BackupContext.Provider>
  );
}

export function useBackup() {
  const context = useContext(BackupContext);

  if (!context) {
    throw new Error('useBackup must be used within BackupProvider');
  }

  return context;
}
