import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join } from 'path'

const publicDir = join(import.meta.dir, '../public')
const svg = readFileSync(join(publicDir, 'favicon.svg'))

await sharp(svg).resize(32, 32).png().toFile(join(publicDir, 'favicon.png'))
await sharp(svg).resize(180, 180).png().toFile(join(publicDir, 'apple-touch-icon.png'))

console.log('[icons] favicon.png e apple-touch-icon.png gerados')
