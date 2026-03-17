import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const root = new URL('../', import.meta.url)
const rootPath = fileURLToPath(root)
const inputPath = path.resolve(rootPath, 'public/icons/app-icon.svg')
const outputDir = path.resolve(rootPath, 'public/icons')

await mkdir(outputDir, { recursive: true })

const svgBuffer = await readFile(inputPath)

await sharp(svgBuffer)
  .resize(192, 192)
  .png()
  .toFile(path.join(outputDir, 'icon-192.png'))

await sharp(svgBuffer)
  .resize(512, 512)
  .png()
  .toFile(path.join(outputDir, 'icon-512.png'))

await sharp(svgBuffer)
  .resize(512, 512)
  .extend({
    top: 48,
    bottom: 48,
    left: 48,
    right: 48,
    background: '#0D3B66',
  })
  .resize(512, 512)
  .png()
  .toFile(path.join(outputDir, 'maskable-512.png'))

console.log('Generated PWA icons in public/icons')
