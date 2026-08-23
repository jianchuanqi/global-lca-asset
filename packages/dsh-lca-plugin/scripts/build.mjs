import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
const graphUiDir = resolve(packageDir, '../dsh-lca-graph-ui')
const clientOutfile = resolve(packageDir, 'lib/client-ui.js')

execFileSync('tsc', ['-p', 'tsconfig.build.json'], { cwd: packageDir, stdio: 'inherit' })
mkdirSync(dirname(clientOutfile), { recursive: true })
execFileSync(process.execPath, [resolve(graphUiDir, 'scripts/build.mjs')], {
  cwd: graphUiDir,
  env: {
    ...process.env,
    DSH_CLIENT_ONLY: 'true',
    DSH_CLIENT_MODULE_ID: '@global-lca/dsh-lca-plugin',
    DSH_CLIENT_OUTFILE: clientOutfile,
  },
  stdio: 'inherit',
})
