import process from 'node:process'

import { runKitRules } from './kit-rules.mjs'

const result = await runKitRules()

if (result.findings.length > 0) {
  console.error('\n[kit-rules] Abateri de la regulile kitului:\n')
  for (const finding of result.findings) {
    console.error(`- ${finding.filePath}:${finding.line} [${finding.rule}] ${finding.message}`)
    if (finding.preview) {
      console.error(`  ${finding.preview}`)
    }
  }
  console.error(
    `\n${result.findings.length} abatere(i). Regulile: docs/redesign/tokens.md și secțiunea despre kit din CLAUDE.md.`,
  )
  process.exit(1)
}

if (result.scannedFiles.length === 0) {
  console.log(`[kit-rules] Niciun fișier de verificat în: ${result.dirs.join(', ')}.`)
  process.exit(0)
}

console.log(`[kit-rules] OK — ${result.scannedFiles.length} fișier(e) verificate, fără abateri.`)
