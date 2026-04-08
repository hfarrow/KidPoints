import { create } from 'zustand';

import type { AppLogLevel } from './logger';

export const APP_LOG_BUFFER_LIMIT = 200;

export type AppBufferedLogEntry = {
  fullText: string;
  id: number;
  level: AppLogLevel;
  namespace: string | null;
  previewText: string;
  timestampMs: number;
};

type AppLogBufferState = {
  appendEntry: (entry: Omit<AppBufferedLogEntry, 'id'>) => void;
  entries: AppBufferedLogEntry[];
  nextId: number;
  resetEntries: () => void;
};

const useAppLogBufferStore = create<AppLogBufferState>()((set) => ({
  appendEntry: (entry) => {
    set((state) => ({
      entries: [
        {
          ...entry,
          id: state.nextId,
        },
        ...state.entries,
      ].slice(0, APP_LOG_BUFFER_LIMIT),
      nextId: state.nextId + 1,
    }));
  },
  entries: [],
  nextId: 1,
  resetEntries: () => {
    set({
      entries: [],
      nextId: 1,
    });
  },
}));

export function appendAppBufferedLogEntry(
  entry: Omit<AppBufferedLogEntry, 'id'>,
) {
  useAppLogBufferStore.getState().appendEntry(entry);
}

export function resetAppLogBuffer() {
  useAppLogBufferStore.getState().resetEntries();
}

export function getAppBufferedLogEntries() {
  return useAppLogBufferStore.getState().entries;
}

export function useAppLogBuffer<T>(
  selector: (state: Pick<AppLogBufferState, 'entries'>) => T,
) {
  return useAppLogBufferStore((state) => selector({ entries: state.entries }));
}
