import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // I test di integrazione toccano il database e non vanno eseguiti in
    // parallelo fra loro: si passerebbero i dati a vicenda.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ['tests/setup.ts'],
  },
});
