/**
 * @deprecated Folosește `importScripts: ['/push-handlers.js']` în next.config.js (next-pwa).
 * Injecția post-build nu mai e cablată în package.json — sw.js e generat de Workbox în timpul build-ului.
 * Păstrat doar pentru debugging local: `node scripts/append-push-sw-import.js`
 */
const fs = require('fs')
const path = require('path')

const swPath = path.join(__dirname, '..', 'public', 'sw.js')
const pushHandlersPath = path.join(__dirname, '..', 'public', 'push-handlers.js')
const beginMarker = '/*__ZMEUREL_PUSH_HANDLERS_BEGIN__*/'
const endMarker = '/*__ZMEUREL_PUSH_HANDLERS_END__*/'

if (!fs.existsSync(swPath)) {
  console.warn('[append-push-sw-import] public/sw.js missing — skip')
  process.exit(0)
}

if (!fs.existsSync(pushHandlersPath)) {
  console.warn('[append-push-sw-import] public/push-handlers.js missing — skip')
  process.exit(0)
}

let s = fs.readFileSync(swPath, 'utf8')

const injectedBlock =
  `\n${beginMarker}\n` +
  fs.readFileSync(pushHandlersPath, 'utf8').trim() +
  `\n${endMarker}\n`

if (s.includes(beginMarker) && s.includes(endMarker)) {
  s = s.replace(new RegExp(`${beginMarker}[\\s\\S]*?${endMarker}\\n?`, 'm'), injectedBlock)
} else {
  s = s.trimEnd() + injectedBlock
}

fs.writeFileSync(swPath, s)
console.log('[append-push-sw-import] inlined push handlers into public/sw.js')
