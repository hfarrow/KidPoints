module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.cjs'],
  setupFilesAfterEnv: ['./jest.afterEnv.cjs'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};
