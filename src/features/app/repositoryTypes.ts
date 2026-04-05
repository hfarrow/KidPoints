import type { PersistedAppDocument } from './transactions';

export interface AppRepository {
  load(): Promise<PersistedAppDocument>;
  save(document: PersistedAppDocument): Promise<void>;
}
