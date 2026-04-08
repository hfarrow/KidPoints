import {
  buildShareableLogText,
  shareBufferedLogsAsync,
} from '../../../src/features/logs/shareLogs';

const mockFileWrite = jest.fn();
const mockFileConstructor = jest.fn();
const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();

jest.mock('expo-file-system', () => ({
  File: function MockFile(...args: unknown[]) {
    mockFileConstructor(...args);

    return {
      uri: 'cache://kidpoints-log-export.txt',
      write: mockFileWrite,
    };
  },
  Paths: {
    cache: 'cache://',
  },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

describe('shareBufferedLogsAsync', () => {
  beforeEach(() => {
    mockFileConstructor.mockReset();
    mockFileWrite.mockReset();
    mockIsAvailableAsync.mockReset();
    mockShareAsync.mockReset();
  });

  it('builds a readable text export', () => {
    const content = buildShareableLogText({
      entries: [
        {
          fullText: '[INFO ] [09:00:00.000] [alpha]: First log',
          id: 1,
          level: 'info',
          namespace: 'alpha',
          previewText: 'First log',
          timestampMs: 1,
        },
        {
          fullText: '[WARN ] [09:01:00.000] [beta]: Second log',
          id: 2,
          level: 'warn',
          namespace: 'beta',
          previewText: 'Second log',
          timestampMs: 2,
        },
      ],
      selectedLogLevel: 'warn',
      selectedNamespaceIds: ['alpha', 'beta'],
    });

    expect(content).toContain('KidPoints Logs');
    expect(content).toContain('Visible Log Count: 2');
    expect(content).toContain('Log Level Filter: WARN and above');
    expect(content).toContain('Namespace Filter: alpha, beta');
    expect(content).toContain('[INFO ] [09:00:00.000] [alpha]: First log');
    expect(content).toContain('[WARN ] [09:01:00.000] [beta]: Second log');
  });

  it('writes a temp file and opens the system share sheet', async () => {
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);

    await expect(
      shareBufferedLogsAsync({
        entries: [
          {
            fullText: '[INFO ] [09:00:00.000] [alpha]: First log',
            id: 1,
            level: 'info',
            namespace: 'alpha',
            previewText: 'First log',
            timestampMs: 1,
          },
        ],
        selectedLogLevel: 'all',
        selectedNamespaceIds: [],
      }),
    ).resolves.toEqual({ ok: true });

    expect(mockFileConstructor).toHaveBeenCalledWith(
      'cache://',
      expect.stringMatching(/^kidpoints-logs-.*\.txt$/u),
    );
    expect(mockFileWrite).toHaveBeenCalledWith(
      expect.stringContaining('KidPoints Logs'),
    );
    expect(mockShareAsync).toHaveBeenCalledWith(
      'cache://kidpoints-log-export.txt',
      {
        UTI: 'public.plain-text',
        dialogTitle: 'Share Logs',
        mimeType: 'text/plain',
      },
    );
  });

  it('returns an unavailable result when sharing is not supported', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(
      shareBufferedLogsAsync({
        entries: [],
        selectedLogLevel: 'all',
        selectedNamespaceIds: [],
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'sharing-unavailable',
    });

    expect(mockFileConstructor).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
  });
});
