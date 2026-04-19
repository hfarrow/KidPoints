import { File, Paths } from 'expo-file-system';
import {
  type LocalBackupSnapshot,
  SHARED_BACKUP_FILE_NAME,
  type SharedBackupPayload,
  validateSharedBackupPayload,
} from './backupModels';

const BACKUP_METADATA_FILE_NAME = 'kidpoints-shared-backup-meta.json';

type BackupStorageMetadata = {
  lastExportUri: string | null;
};

function getLocalBackupFile() {
  return new File(Paths.document, SHARED_BACKUP_FILE_NAME);
}

function getBackupMetadataFile() {
  return new File(Paths.document, BACKUP_METADATA_FILE_NAME);
}

export function getLocalBackupFileUri() {
  return getLocalBackupFile().uri;
}

export function readBackupStorageMetadata(): BackupStorageMetadata {
  const file = getBackupMetadataFile();

  if (!file.exists) {
    return {
      lastExportUri: null,
    };
  }

  try {
    const parsedValue = JSON.parse(
      file.textSync(),
    ) as Partial<BackupStorageMetadata>;

    return {
      lastExportUri:
        typeof parsedValue.lastExportUri === 'string'
          ? parsedValue.lastExportUri
          : null,
    };
  } catch {
    return {
      lastExportUri: null,
    };
  }
}

export function writeBackupStorageMetadata(metadata: BackupStorageMetadata) {
  const file = getBackupMetadataFile();

  file.create({
    intermediates: true,
    overwrite: true,
  });
  file.write(JSON.stringify(metadata));
}

export function writeLocalBackup(
  payload: SharedBackupPayload,
): LocalBackupSnapshot {
  const file = getLocalBackupFile();

  file.create({
    intermediates: true,
    overwrite: true,
  });
  file.write(JSON.stringify(payload));

  return {
    backupSchemaVersion: payload.backupSchemaVersion,
    createdAt: payload.createdAt,
    originDeviceId: payload.originDeviceId,
    reason: payload.reason,
    uri: file.uri,
  };
}

export function readLocalBackup():
  | {
      ok: true;
      payload: SharedBackupPayload;
      snapshot: LocalBackupSnapshot;
    }
  | {
      error: string;
      ok: false;
      reason: 'invalid' | 'missing';
    } {
  const file = getLocalBackupFile();

  if (!file.exists) {
    return {
      error: 'No local backup was found.',
      ok: false,
      reason: 'missing',
    };
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(file.textSync());
  } catch {
    return {
      error: 'The local backup file could not be read.',
      ok: false,
      reason: 'invalid',
    };
  }

  const validation = validateSharedBackupPayload(parsedValue);

  if (!validation.ok) {
    return {
      error: validation.error,
      ok: false,
      reason: 'invalid',
    };
  }

  return {
    ok: true,
    payload: validation.payload,
    snapshot: {
      backupSchemaVersion: validation.payload.backupSchemaVersion,
      createdAt: validation.payload.createdAt,
      originDeviceId: validation.payload.originDeviceId,
      reason: validation.payload.reason,
      uri: file.uri,
    },
  };
}
