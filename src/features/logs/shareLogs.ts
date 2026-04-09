import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { AppBufferedLogEntry } from '../../logging/logBufferStore';
import type { AppLogLevel } from '../../logging/logger';

export type ShareBufferedLogsArgs = {
  entries: AppBufferedLogEntry[];
  selectedLogLevel: AppLogLevel | 'all';
  selectedNamespaceIds: string[];
};

export type ShareBufferedLogsResult =
  | { ok: true }
  | { ok: false; reason: 'sharing-unavailable' };

export function buildShareableLogText({
  entries,
  selectedLogLevel,
  selectedNamespaceIds,
}: ShareBufferedLogsArgs) {
  const exportedAt = new Date();
  const levelLabel =
    selectedLogLevel === 'all'
      ? 'All Levels'
      : `${selectedLogLevel.toUpperCase()} and above`;
  const namespaceLabel =
    selectedNamespaceIds.length === 0
      ? 'All Namespaces'
      : selectedNamespaceIds.join(', ');
  const lines = [
    'KidPoints Logs',
    `Exported: ${exportedAt.toISOString()}`,
    `Exported Log Count: ${entries.length}`,
    `Log Level Filter: ${levelLabel}`,
    `Namespace Filter: ${namespaceLabel}`,
    '',
    '---',
    '',
    ...entries.flatMap((entry, index) =>
      index === entries.length - 1 ? [entry.fullText] : [entry.fullText, ''],
    ),
  ];

  return lines.join('\n');
}

export async function shareBufferedLogsAsync(
  args: ShareBufferedLogsArgs,
): Promise<ShareBufferedLogsResult> {
  if (!(await Sharing.isAvailableAsync())) {
    return {
      ok: false,
      reason: 'sharing-unavailable',
    };
  }

  const file = new File(
    Paths.cache,
    `kidpoints-logs-${Date.now().toString(36)}.txt`,
  );
  file.write(buildShareableLogText(args));

  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Share Logs',
    mimeType: 'text/plain',
    UTI: 'public.plain-text',
  });

  return { ok: true };
}
