/** Run the attached DeepSeek Harness checkout with both local LCA plugin packages. */

import { accessSync, constants, mkdirSync, realpathSync, symlinkSync } from 'node:fs'
import { delimiter, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repository = resolve(fileURLToPath(new URL('..', import.meta.url)))
const harness = process.env.DEEPSEEK_HARNESS_DIR ?? '/Users/jianchuan/Dev/deepseek-harness'
const dshHome = process.env.DSH_HOME ?? resolve(repository, '.dsh-local')
const workspaceModules = resolve(repository, 'node_modules/.pnpm/node_modules')
const patch = resolve(repository, 'config/deepseek-harness.local.patch.yml')

accessSync(resolve(harness, 'package.json'), constants.R_OK)
accessSync(resolve(repository, 'packages/dsh-lca-plugin/lib/index.js'), constants.R_OK)
accessSync(resolve(repository, 'packages/dsh-lca-plugin/lib/client-ui.js'), constants.R_OK)

// Bare package names are required for client-plugin discovery. Expose the two
// local packages through the profile's normal Node lookup path without
// installing or modifying anything in the attached Harness checkout.
const scopeDir = resolve(dshHome, 'profiles/node_modules/@global-lca')
mkdirSync(scopeDir, { recursive: true })
for (const packageName of ['dsh-lca-plugin']) {
  const target = resolve(repository, 'packages', packageName)
  const link = resolve(scopeDir, packageName)
  try {
    symlinkSync(target, link, 'dir')
  } catch (error) {
    if (error?.code !== 'EEXIST' || realpathSync(link) !== realpathSync(target)) throw error
  }
}

const child = spawn(
  'pnpm',
  ['dsh', 'web', '--patch', patch, ...process.argv.slice(2)],
  {
    cwd: harness,
    env: {
      ...process.env,
      DSH_HOME: dshHome,
      NODE_PATH: [workspaceModules, process.env.NODE_PATH].filter(Boolean).join(delimiter),
    },
    stdio: 'inherit',
  },
)

child.on('exit', (code, signal) => {
  if (signal !== null) process.kill(process.pid, signal)
  process.exitCode = code ?? 1
})
