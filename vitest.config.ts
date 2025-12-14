import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Prevent Vite from loading project PostCSS config in tests
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: { enabled: false },
  },
});
