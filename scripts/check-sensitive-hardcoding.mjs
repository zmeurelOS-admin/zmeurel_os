import process from 'node:process'

import { runSensitiveHardcodingGuard } from './sensitive-hardcoding-guard.mjs'

const scanAll = process.argv.includes('--all')

const result = await runSensitiveHardcodingGuard({ scanAll })

if (result.findings.length > 0) {
  console.error('\n[sensitive-hardcoding-guard] Au fost detectate patternuri periculoase în fișiere noi/modificate:\n')
  for (const finding of result.findings) {
    console.error(`- ${finding.filePath}:${finding.line} [${finding.rule}] ${finding.message}`)
    if (finding.preview) {
      console.error(`  ${finding.preview}`)
    }
  }
  console.error('\nFix recomandat: mută emailurile sensibile, allowlist-urile și secretele în env/config sau în roluri/user_ids, nu în literal strings din cod.')
  process.exit(1)
}

if (result.scannedFiles.length === 0) {
  console.log('[sensitive-hardcoding-guard] Niciun fișier relevant nou/modificat de scanat.')
  process.exit(0)
}

console.log(`[sensitive-hardcoding-guard] OK — ${result.scannedFiles.length} fișier(e) relevante scanate, fără patternuri blocate.`)
