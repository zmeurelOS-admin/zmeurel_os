/**
 * Derive maskable PWA icon + monochrome push badge from public/icon-512.png.
 * Run: node scripts/generate-pwa-icon-derivatives.mjs
 */
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const source = path.join(root, 'public', 'icon-512.png')
const brandGreen = { r: 22, g: 101, b: 52, alpha: 1 }

const MASKABLE_SIZE = 512
const MASKABLE_LOGO_RATIO = 0.66
const BADGE_SIZE = 96

async function writeMaskable() {
  const logoSize = Math.round(MASKABLE_SIZE * MASKABLE_LOGO_RATIO)
  const logo = await sharp(source).resize(logoSize, logoSize, { fit: 'contain' }).png().toBuffer()

  await sharp({
    create: {
      width: MASKABLE_SIZE,
      height: MASKABLE_SIZE,
      channels: 4,
      background: brandGreen,
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(root, 'public', 'icon-512-maskable.png'))

  console.log('Wrote public/icon-512-maskable.png')
}

async function writeBadge() {
  const { data, info } = await sharp(source)
    .resize(BADGE_SIZE, BADGE_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const greenLum = (brandGreen.r + brandGreen.g + brandGreen.b) / 3

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = (r + g + b) / 3
    const whiteness = Math.min(r, g, b)
    const alpha = Math.round(Math.max(0, Math.min(255, (whiteness - greenLum) * 2.2)))

    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
    data[i + 3] = alpha
  }

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(path.join(root, 'public', 'badge-96.png'))

  console.log('Wrote public/badge-96.png')
}

await writeMaskable()
await writeBadge()
