/**
 * După `next build`, next-pwa regenerează `public/sw.js`. Acest script adaugă `importScripts`
 * pentru handler-ele push, fără a modifica bundle-ul Workbox.
 */
const fs = require('fs')
const path = require('path')

const swPath = path.join(__dirname, '..', 'public', 'sw.js')
const marker = "importScripts('/push-handlers.js')"

if (!fs.existsSync(swPath)) {
  console.warn('[append-push-sw-import] public/sw.js missing — skip')
  process.exit(0)
}

let s = fs.readFileSync(swPath, 'utf8')
if (s.includes(marker)) {
  console.log('[append-push-sw-import] already present')
  process.exit(0)
}

s = s.trimEnd() + '\n' + marker + ';\n'
fs.writeFileSync(swPath, s)
console.log('[append-push-sw-import] appended importScripts to public/sw.js')
