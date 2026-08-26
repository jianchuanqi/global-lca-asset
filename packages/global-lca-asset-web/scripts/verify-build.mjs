import { readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = join(projectRoot, 'dist', 'assets')
const files = readdirSync(assetsDir)
const javascript = files
  .filter(name => name.endsWith('.js'))
  .map(name => ({ name, bytes: statSync(join(assetsDir, name)).size }))
const oversized = javascript.filter(file => file.bytes > 500_000)
if (oversized.length > 0) {
  throw new Error(`JavaScript chunks exceed 500 kB: ${oversized.map(file => `${file.name} (${file.bytes} bytes)`).join(', ')}`)
}

const datasets = files.filter(name => /^dataset-[A-Za-z0-9_-]+\.json$/.test(name))
if (datasets.length !== 1) {
  throw new Error(`Expected one hashed dataset JSON asset, found ${datasets.length}: ${datasets.join(', ')}`)
}

const largest = javascript.reduce((current, file) => Math.max(current, file.bytes), 0)
const datasetBytes = statSync(join(assetsDir, datasets[0])).size
console.log(
  `Verified web build: ${javascript.length} JS chunks, largest ${(largest / 1000).toFixed(2)} kB; `
  + `dataset asset ${(datasetBytes / 1000).toFixed(2)} kB.`,
)
