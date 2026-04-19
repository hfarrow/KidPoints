import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';
import {
  BackupProvider,
  useBackup,
} from '../../../src/features/backup/BackupProvider';
import { createSharedBackupPayload } from '../../../src/features/backup/backupModels';
import {
  createInitialSharedDocument,
  createSharedStore,
  SharedStoreProvider,
  useSharedStore,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockStoredFiles = new Map<string, string>();
let mockPickedFileUri: string | null = null;
const mockIsSharingAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();

jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) =>
    mockIsSharingAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;

    constructor(...segments: unknown[]) {
      this.uri = segments
        .map((segment) =>
          typeof segment === 'string'
            ? segment
            : ((segment as { uri?: string } | null)?.uri ?? ''),
        )
        .join('');
    }

    static async pickFileAsync() {
      if (!mockPickedFileUri) {
        throw new Error('User canceled file picker');
      }

      return new MockFile(mockPickedFileUri);
    }

    create() {
      mockStoredFiles.set(this.uri, mockStoredFiles.get(this.uri) ?? '');
    }

    get exists() {
      return mockStoredFiles.has(this.uri);
    }

    async text() {
      return this.textSync();
    }

    textSync() {
      const content = mockStoredFiles.get(this.uri);

      if (content == null) {
        throw new Error('File not found');
      }

      return content;
    }

    write(content: string) {
      mockStoredFiles.set(this.uri, content);
    }
  }

  return {
    File: MockFile,
    Paths: {
      cache: 'cache://',
      document: 'document://',
    },
  };
});

function BackupProbe() {
  const {
    createBackup,
    exportBackup,
    importBackup,
    internalBackupUri,
    lastExportUri,
    localBackup,
    restoreLocalBackup,
  } = useBackup();
  const addChild = useSharedStore((state) => state.addChild);
  const childCount = useSharedStore(
    (state) => state.document.head.activeChildIds.length,
  );
  const [importStatus, setImportStatus] = useState('idle');
  const [restoreLocalStatus, setRestoreLocalStatus] = useState('idle');

  return (
    <>
      <Text testID="child-count">{childCount}</Text>
      <Text testID="internal-backup-uri">{internalBackupUri}</Text>
      <Text testID="local-created-at">{localBackup?.createdAt ?? 'none'}</Text>
      <Text testID="import-status">{importStatus}</Text>
      <Text testID="restore-local-status">{restoreLocalStatus}</Text>
      <Text testID="last-export-uri">{lastExportUri ?? 'none'}</Text>
      <Text
        onPress={() => {
          void createBackup('manual');
        }}
      >
        Create Backup
      </Text>
      <Text
        onPress={() => {
          addChild(`Child ${childCount + 1}`);
        }}
      >
        Add Child
      </Text>
      <Text
        onPress={() => {
          void exportBackup();
        }}
      >
        Export Backup
      </Text>
      <Text
        onPress={() => {
          void importBackup().then((result) => {
            setImportStatus(result.ok ? 'ok' : result.error);
          });
        }}
      >
        Import Backup
      </Text>
      <Text
        onPress={() => {
          void restoreLocalBackup().then((result) => {
            setRestoreLocalStatus(result.ok ? 'ok' : result.error);
          });
        }}
      >
        Restore Local Backup
      </Text>
    </>
  );
}

describe('BackupProvider', () => {
  beforeEach(() => {
    mockPickedFileUri = null;
    mockStoredFiles.clear();
    mockIsSharingAvailableAsync.mockReset();
    mockShareAsync.mockReset();
    mockIsSharingAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    jest.clearAllMocks();
  });

  it('imports a picked backup file into a fresh install', async () => {
    const sourceStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'backup-provider-import-source',
      }),
      storage: createMemoryStorage(),
    });

    expect(sourceStore.getState().addChild('Ava').ok).toBe(true);

    const importedPayload = createSharedBackupPayload({
      createdAt: '2026-04-20T01:10:00.000Z',
      document: sourceStore.getState().document,
      reason: 'manual',
    });

    mockPickedFileUri = 'picked://kidpoints-shared-backup.json';
    mockStoredFiles.set(mockPickedFileUri, JSON.stringify(importedPayload));

    render(
      <SharedStoreProvider
        initialDocument={createInitialSharedDocument({
          deviceId: 'backup-provider-fresh-install',
        })}
        storage={createMemoryStorage()}
      >
        <BackupProvider>
          <BackupProbe />
        </BackupProvider>
      </SharedStoreProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Import Backup'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('import-status').props.children).toBe('ok'),
    );
    await waitFor(() =>
      expect(screen.getByTestId('child-count').props.children).toBe(1),
    );
    expect(screen.getByTestId('local-created-at').props.children).toBe(
      importedPayload.createdAt,
    );
  });

  it('exports the latest backup to a picked directory', async () => {
    render(
      <SharedStoreProvider
        initialDocument={createInitialSharedDocument({
          deviceId: 'backup-provider-export-source',
        })}
        storage={createMemoryStorage()}
      >
        <BackupProvider>
          <BackupProbe />
        </BackupProvider>
      </SharedStoreProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Export Backup'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('local-created-at').props.children).not.toBe(
        'none',
      ),
    );
    expect(screen.getByTestId('internal-backup-uri').props.children).toBe(
      'document://kidpoints-shared-backup.json',
    );
    expect(screen.getByTestId('last-export-uri').props.children).toMatch(
      /^cache:\/\/kidpoints-shared-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.json$/u,
    );
    const exportUri = screen.getByTestId('last-export-uri').props.children;
    expect(typeof exportUri).toBe('string');
    expect(mockStoredFiles.has(exportUri)).toBe(true);
    expect(mockShareAsync).toHaveBeenCalledTimes(1);
    expect(mockShareAsync).toHaveBeenCalledWith(exportUri, {
      UTI: 'public.json',
      dialogTitle: 'Export Backup',
      mimeType: 'application/json',
    });
  });

  it('restores the internal backup without picking a file', async () => {
    render(
      <SharedStoreProvider
        initialDocument={createInitialSharedDocument({
          deviceId: 'backup-provider-restore-local',
        })}
        storage={createMemoryStorage()}
      >
        <BackupProvider>
          <BackupProbe />
        </BackupProvider>
      </SharedStoreProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Add Child'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('child-count').props.children).toBe(1),
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Create Backup'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('local-created-at').props.children).not.toBe(
        'none',
      ),
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Add Child'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('child-count').props.children).toBe(2),
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Restore Local Backup'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('restore-local-status').props.children).toBe(
        'ok',
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId('child-count').props.children).toBe(1),
    );
  });
});
