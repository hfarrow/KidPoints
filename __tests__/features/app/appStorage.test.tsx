import { describe, expect, it } from '@jest/globals';

import { createInitialParentSession } from '../../../src/features/app/parentSession';

describe('createInitialParentSession', () => {
  it('defaults parent mode to unlocked in development builds', () => {
    expect(__DEV__).toBe(true);
    expect(createInitialParentSession()).toEqual({
      isUnlocked: true,
    });
  });
});
