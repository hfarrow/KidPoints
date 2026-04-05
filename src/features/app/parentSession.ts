import type { ParentSession } from './types';

export function createInitialParentSession(): ParentSession {
  return {
    isUnlocked: __DEV__,
  };
}
