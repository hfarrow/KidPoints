import { isSharedDocument } from '../../state/sharedStore';
import type { SharedDocument } from '../../state/sharedTypes';

export const SHARED_BACKUP_SCHEMA_VERSION = 1 as const;
export const SHARED_BACKUP_FILE_NAME = 'kidpoints-shared-backup.json';
export const SHARED_BACKUP_MIME_TYPE = 'application/json';

export type BackupReason = 'manual' | 'pre-sync';

export type BackupMetadata = {
  backupSchemaVersion: typeof SHARED_BACKUP_SCHEMA_VERSION;
  createdAt: string;
  originDeviceId: string;
  reason: BackupReason;
};

export type SharedBackupPayload = BackupMetadata & {
  document: SharedDocument;
};

export type LocalBackupSnapshot = BackupMetadata & {
  uri: string;
};

export type ValidateSharedBackupPayloadResult =
  | {
      ok: true;
      payload: SharedBackupPayload;
    }
  | {
      error: string;
      ok: false;
    };

function isBackupReason(value: unknown): value is BackupReason {
  return value === 'manual' || value === 'pre-sync';
}

function isIsoDateString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

export function createSharedBackupPayload(args: {
  createdAt?: string;
  document: SharedDocument;
  reason: BackupReason;
}): SharedBackupPayload {
  return {
    backupSchemaVersion: SHARED_BACKUP_SCHEMA_VERSION,
    createdAt: args.createdAt ?? new Date().toISOString(),
    document: args.document,
    originDeviceId: args.document.deviceId,
    reason: args.reason,
  };
}

export function validateSharedBackupPayload(
  value: unknown,
): ValidateSharedBackupPayloadResult {
  if (!value || typeof value !== 'object') {
    return {
      error: 'The backup payload was not an object.',
      ok: false,
    };
  }

  const candidate = value as Partial<SharedBackupPayload>;
  const createdAt = candidate.createdAt;
  const originDeviceId = candidate.originDeviceId;
  const reason = candidate.reason;
  const document = candidate.document;

  if (candidate.backupSchemaVersion !== SHARED_BACKUP_SCHEMA_VERSION) {
    return {
      error: 'The backup schema version was not supported.',
      ok: false,
    };
  }

  if (!isIsoDateString(createdAt)) {
    return {
      error: 'The backup did not include a valid timestamp.',
      ok: false,
    };
  }

  if (typeof originDeviceId !== 'string' || originDeviceId.length === 0) {
    return {
      error: 'The backup did not include a valid origin device id.',
      ok: false,
    };
  }

  if (!isBackupReason(reason)) {
    return {
      error: 'The backup did not include a valid backup reason.',
      ok: false,
    };
  }

  if (!isSharedDocument(document)) {
    return {
      error: 'The backup did not include a valid shared document.',
      ok: false,
    };
  }

  return {
    ok: true,
    payload: {
      backupSchemaVersion: SHARED_BACKUP_SCHEMA_VERSION,
      createdAt,
      document,
      originDeviceId,
      reason,
    },
  };
}
