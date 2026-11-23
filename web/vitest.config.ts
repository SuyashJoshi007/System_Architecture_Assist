import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**/*.ts', 'src/App.tsx', 'src/components/**/*.tsx'],
      exclude: ['src/components/Icon.tsx'],
      thresholds: { statements: 80, branches: 75, functions: 80, lines: 80 },
    },
  },
});
