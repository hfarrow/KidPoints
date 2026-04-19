import type { SyncBundle, SyncRollbackSnapshot } from '../../state/sharedSync';
import type {
  SharedCommandResult,
  SharedDocument,
} from '../../state/sharedTypes';
import type { BackupReason } from '../backup/backupModels';

type CreateBackupResult =
  | {
      metadata: unknown;
      ok: true;
      source: 'local' | 'remote';
    }
  | {
      error: string;
      ok: false;
    };

export async function applyPreparedSyncBundle(args: {
  applySyncBundle: (
    bundle: SyncBundle,
    rollbackSnapshot: SyncRollbackSnapshot,
  ) => SharedCommandResult;
  bundleHash: string;
  createBackup: (reason: BackupReason) => Promise<CreateBackupResult>;
  currentDocument: SharedDocument;
  preparedBundle: {
    localRollbackSnapshot: SyncRollbackSnapshot;
    sharedBundle: SyncBundle;
  };
}) {
  if (
    args.currentDocument.syncState?.lastAppliedSync?.bundleHash ===
    args.bundleHash
  ) {
    return { ok: true as const };
  }

  const backupResult = await args.createBackup('pre-sync');

  if (!backupResult.ok) {
    return {
      error: backupResult.error,
      ok: false as const,
    };
  }

  return args.applySyncBundle(
    args.preparedBundle.sharedBundle,
    args.preparedBundle.localRollbackSnapshot,
  );
}
