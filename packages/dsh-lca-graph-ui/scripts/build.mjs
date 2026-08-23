import { execFileSync } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { build } from 'esbuild'

const packageId = '@global-lca/dsh-lca-graph-ui'
const clientId = process.env.DSH_CLIENT_MODULE_ID ?? packageId
const clientOnly = process.env.DSH_CLIENT_ONLY === 'true'
const clientOutfile = process.env.DSH_CLIENT_OUTFILE ?? 'lib/client.js'

if (!clientOnly) {
  await rm(new URL('../lib', import.meta.url), { recursive: true, force: true })

  execFileSync('tsc', ['-p', 'tsconfig.build.json'], { stdio: 'inherit' })

  await build({
    entryPoints: ['src/index.ts'],
    outfile: 'lib/index.js',
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2023',
    sourcemap: true,
  })
}

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: clientOutfile,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2023',
  sourcemap: true,
  loader: { '.css': 'text' },
  external: [
    'react',
    'react/jsx-runtime',
    '@deepseek-ai/dsh-client-ui-primitives',
  ],
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(clientId)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  footer: { js: 'return module.exports; } });' },
})
