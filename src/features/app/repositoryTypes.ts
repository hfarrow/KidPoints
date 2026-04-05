import type { PersistedAppData } from './types';

export interface AppRepository {
  load(): Promise<PersistedAppData>;
  save(data: PersistedAppData): Promise<void>;
}

export type { PersistedAppData };
