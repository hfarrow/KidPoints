/* global beforeEach, jest */

beforeEach(() => {
  const { clearCapturedAppLogs } = jest.requireActual('./src/logging/logger');

  clearCapturedAppLogs();
});
