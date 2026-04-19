import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  SHARED_BACKUP_FILE_NAME,
  SHARED_BACKUP_MIME_TYPE,
  type SharedBackupPayload,
  validateSharedBackupPayload,
} from './backupModels';

function readPickedFile(pickedFile: unknown): File | null {
  if (!pickedFile) {
    return null;
  }

  return Array.isArray(pickedFile)
    ? ((pickedFile[0] as File | undefined) ?? null)
    : (pickedFile as File);
}

export function isBackupPickerCancelled(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return message.toLowerCase().includes('cancel');
}

function buildPortableBackupFileName(createdAt: string) {
  const baseName = SHARED_BACKUP_FILE_NAME.replace(/\.json$/u, '');
  const safeTimestamp = createdAt
    .replace(/\.\d+Z$/u, 'Z')
    .replaceAll(':', '-')
    .replace(/[^0-9A-Za-z-]/gu, '-')
    .replace(/-+/gu, '-');

  return `${baseName}-${safeTimestamp}.json`;
}

export async function exportBackupToPickedDirectory(
  payload: SharedBackupPayload,
) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const exportFile = new File(
    Paths.cache,
    buildPortableBackupFileName(payload.createdAt),
  );

  exportFile.create({
    intermediates: true,
    overwrite: true,
  });
  exportFile.write(JSON.stringify(payload));
  await Sharing.shareAsync(exportFile.uri, {
    dialogTitle: 'Export Backup',
    mimeType: SHARED_BACKUP_MIME_TYPE,
    UTI: 'public.json',
  });

  return {
    uri: exportFile.uri,
  };
}

export async function importBackupFromPickedFile() {
  const pickedFile = readPickedFile(
    await File.pickFileAsync(undefined, SHARED_BACKUP_MIME_TYPE),
  );

  if (!pickedFile) {
    throw new Error('No backup file was selected.');
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(await pickedFile.text());
  } catch {
    throw new Error('The selected backup file could not be read.');
  }

  const validation = validateSharedBackupPayload(parsedValue);

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return {
    payload: validation.payload,
    uri: pickedFile.uri,
  };
}
