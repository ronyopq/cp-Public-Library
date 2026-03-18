import esbuild from 'esbuild'
import path from 'path'
import url from 'url'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read tsconfig to get path mappings
const tsConfigWorker = JSON.parse(fs.readFileSync('./tsconfig.worker.json', 'utf8'))
const paths = tsConfigWorker.compilerOptions.paths || {}

// Convert TypeScript paths to esbuild alias
const alias = {}
for (const [key, values] of Object.entries(paths)) {
  const pattern = key.replace('/*', '')
  const replacement = path.resolve(__dirname, values[0].replace('/*', ''))
  alias[pattern] = replacement
}

console.log('esbuild alias:', alias)

esbuild.build({
  entryPoints: ['./worker/index.ts'],
  bundle: true,
  format: 'modules',
  target: 'es2023',
  outfile: 'dist/worker.js',
  external: ['cloudflare:*'],
  alias: alias,
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
  },
}).catch(() => process.exit(1))
