import type { StateStorage } from 'zustand/middleware';

export function createMemoryStorage(
  seed: Record<string, string> = {},
): StateStorage {
  const values = { ...seed };

  return {
    getItem: (name) => values[name] ?? null,
    removeItem: (name) => {
      delete values[name];
    },
    setItem: (name, value) => {
      values[name] = value;
    },
  };
}
