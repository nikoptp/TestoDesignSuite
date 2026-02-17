import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/vitest.setup.ts'],
    include: ['test/unit/**/*.test.ts', 'test/unit/**/*.test.tsx'],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});