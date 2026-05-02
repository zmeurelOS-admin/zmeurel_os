/**
 * După `next build`, next-pwa regenerează `public/sw.js`. Acest script injectează direct
 * handler-ele push în workerul generat, ca să evităm importuri suplimentare care pot fi
 * capturate de guard-ul de auth sau de serving-ul assetelor din producție.
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
