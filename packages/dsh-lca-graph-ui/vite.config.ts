import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-client-ui-primitives': fileURLToPath(new URL(
        '../../../deepseek-harness/packages/client/ui-primitives/src/index.ts',
        import.meta.url,
      )),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1'],
  },
})
