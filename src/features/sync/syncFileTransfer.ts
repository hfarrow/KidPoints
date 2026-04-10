import { File, Paths } from 'expo-file-system';
import {
  type SyncProjection,
  serializeSyncProjection,
  validateSyncProjection,
} from '../../state/sharedSync';

export type ExportSyncProjectionFileResult = {
  exportId: string;
  fileName: string;
  fileUri: string;
  projection: SyncProjection;
  sizeBytes: number;
};

export type LoadSyncProjectionFileResult =
  | {
      ok: true;
      projection: SyncProjection;
    }
  | {
      error: string;
      ok: false;
    };

export function createProjectionExportId() {
  return `projection-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function exportSyncProjectionToFile(args: {
  exportId?: string;
  projection: SyncProjection;
}): ExportSyncProjectionFileResult {
  const exportId = args.exportId ?? createProjectionExportId();
  const fileName = `${exportId}-${args.projection.headHash.slice(-8)}.json`;
  const file = new File(Paths.cache, fileName);
  const contents = serializeSyncProjection(args.projection);

  file.write(contents);

  return {
    exportId,
    fileName,
    fileUri: file.uri,
    projection: args.projection,
    sizeBytes: new TextEncoder().encode(contents).byteLength,
  };
}

export function loadSyncProjectionFromFile(
  fileUri: string,
): LoadSyncProjectionFileResult {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(new File(fileUri).textSync());
  } catch {
    return {
      error: 'The received sync history file could not be read.',
      ok: false,
    };
  }

  const validation = validateSyncProjection(parsedValue as SyncProjection);

  if (!validation.ok) {
    return {
      error: validation.message,
      ok: false,
    };
  }

  return {
    ok: true,
    projection: parsedValue as SyncProjection,
  };
}
